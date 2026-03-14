

## Plano: Integrar Infojudiciais com Hub Jurídico via API do Playground

### Situação atual

**Hub (este projeto):**
- Endpoints de **consulta** (`api-publications`, `api-distributions`, `api-processes`) — autenticação por **API Token** do `client_systems`
- Endpoints de **gerenciamento** (`manage-publication-terms`, `manage-distribution-terms`, `sync-process-management`) — autenticação por **JWT do Supabase** (sessão de usuário logado)

**Infojudiciais:**
- `hub-juridico-crud`: tenta cadastrar termos chamando endpoints de consulta (`api-publications` POST) — **incorreto**, pois esses endpoints só aceitam GET e POST confirm
- `hub-juridico-sync`: faz pull de dados via GET nos endpoints de consulta — **funcional**
- Usa `integracao_apis` com `client_id` (token) e `folder_id` (base URL) para configurar a conexão

### Problema central

Os endpoints de gerenciamento do Hub exigem JWT de sessão (usuário logado no Hub). Isso impede comunicação sistema-a-sistema. O Infojudiciais precisa cadastrar/excluir termos e processos usando seu API token.

### Solução proposta

Criar um novo edge function **`api-management`** no Hub que:
1. Aceita autenticação por **API Token** (igual aos endpoints de consulta)
2. Roteia para as operações corretas de cadastro/exclusão
3. Aplica lógica de **deduplicação** (se o termo já existe no Hub, apenas vincula o `client_system_id`)
4. Se o termo já possui publicações/distribuições, elas ficam imediatamente disponíveis via endpoint de consulta

Depois, atualizar o **`hub-juridico-crud`** no Infojudiciais para chamar corretamente esse novo endpoint.

---

### Alterações no Hub (este projeto)

**1. Novo edge function: `supabase/functions/api-management/index.ts`**

- Autenticação via `validateToken` (mesmo middleware dos endpoints de consulta)
- Ações suportadas via body JSON `{ action, data }`:

```text
Publicações:
  register-pub-term   → Recebe { nome, oab?, service_id }
                        Se termo já existe em search_terms, apenas vincula client via client_search_terms
                        Se não existe, chama register-publication-term para cadastrar na Solucionare
  delete-pub-term     → Desvincula client; se nenhum outro client usa, remove da Solucionare

Distribuições:
  register-dist-term  → Recebe { nome, service_id, abrangencias?, documentos?, oabs?, instancias? }
                        Mesma lógica de deduplicação
  delete-dist-term    → Desvincula; remove se último

Processos:
  register-process    → Recebe { processNumber, instance, uf?, service_id }
                        Se processo já existe, vincula via client_processes
                        Se não existe, cadastra na Solucionare
  delete-process      → Desvincula; remove se último
```

- Toda a lógica de negócio (chamar Solucionare, salvar em `search_terms`/`processes`, vincular em `client_search_terms`/`client_processes`) fica neste endpoint
- Resposta inclui IDs criados para que o Infojudiciais possa correlacionar

**2. `supabase/config.toml`**
- Adicionar `[functions.api-management]` com `verify_jwt = false` (validação por token no código)

---

### Alterações no Infojudiciais (outro projeto)

**3. Reescrever `supabase/functions/hub-juridico-crud/index.ts`**

Substituir as chamadas incorretas aos endpoints de consulta pelas chamadas ao novo `api-management`:

```text
create_termo_pub  → POST api-management { action: "register-pub-term", data: { nome, oab, service_id } }
create_termo_dist → POST api-management { action: "register-dist-term", data: { nome, ... } }
create_processo   → POST api-management { action: "register-process", data: { processNumber, ... } }
delete_*          → POST api-management { action: "delete-*", data: { ... } }
```

- Autenticação: `Authorization: Bearer {hubToken}` (o token do `client_systems` já existente)
- Ao receber resposta com `term_id` ou `process_id` do Hub, salvar o `hub_id` na tabela local

**4. Atualizar `supabase/functions/hub-juridico-sync/index.ts`**

- Manter o fluxo de pull (GET) + confirm existente, que já funciona
- Melhorar o mapeamento de campos para incluir todos os ~25 campos de metadados das publicações/distribuições

---

### Fluxo completo (exemplo: Publicação)

```text
1. Cliente no Info cadastra termo "João Silva" com OAB 12345/PR
2. Info verifica se já existe localmente (deduplicação local)
3. Info chama Hub: POST api-management { action: "register-pub-term", data: { nome: "João Silva", oab: { numero: "12345", uf: "PR" }, service_id: "..." } }
4. Hub recebe, verifica se "João Silva" já existe em search_terms:
   a. SIM → apenas vincula client_system_id via client_search_terms → publicações já existentes ficam disponíveis
   b. NÃO → cadastra na Solucionare (Autenticação → nome_cadastrar → oab_Cadastrar → abrangência) → salva em search_terms → vincula client
5. Hub retorna { success: true, term_id: "...", already_existed: true/false }
6. Info salva hub_id localmente
7. Na próxima sync (pull), Info chama GET api-publications com seu token → recebe publicações daquele termo
```

### Detalhes técnicos

- O `api-management` reutiliza a lógica já existente em `register-publication-term`, `manage-distribution-terms` e `sync-process-management`, invocando-os internamente ou replicando a lógica core
- A deduplicação é garantida em 2 níveis: no Infojudiciais (não envia se já tem localmente) e no Hub (não registra na Solucionare se já existe em `search_terms`)
- O `service_id` do parceiro será passado como configuração no Infojudiciais (junto com o token e URL base)
- Sem alterações de schema no Hub — usa tabelas existentes (`search_terms`, `client_search_terms`, `processes`, `client_processes`)

### Estimativa de escopo
- 1 novo edge function no Hub (~300 linhas)
- 1 reescrita de edge function no Infojudiciais (~200 linhas)
- 1 atualização de edge function no Infojudiciais (sync, ~50 linhas)
- Config.toml do Hub (2 linhas)

