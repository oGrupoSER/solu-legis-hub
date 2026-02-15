
# Plano de Reestruturação: Hub Juridico - Modelo de Consumo Compartilhado

## Contexto e Diagnóstico Atual

### Problemas Identificados

1. **office_code no lugar errado**: O `office_code` está em `client_systems`, mas deveria estar no cadastro do parceiro (ou no `partner_services`). O escritório Solucionare pertence ao contrato do Hub Juridico com a Solucionare, não ao cliente.

2. **Sem controle de duplicidade de termos/processos entre clientes**: Hoje, se dois clientes solicitam o mesmo termo ou processo, o sistema registraria duas vezes na Solucionare, gerando custo dobrado.

3. **Termos sem vínculo com clientes**: Os `search_terms` estão ligados ao `partner_service_id` mas não aos clientes que os solicitaram. Não há como saber qual cliente pediu qual termo.

4. **Processos sem vínculo com clientes**: Tabela `processes` não tem relação com `client_systems`.

5. **Serviço de Distribuições não configurado**: Não existe `partner_service` do tipo `distributions` cadastrado. Também não existem distribuições sincronizadas (0 registros).

6. **Termos de publicação sem relação com clientes**: Os 9 termos existentes estão no serviço "Publicações - Termos e Publicações" mas sem vínculo a nenhum cliente específico.

### Estado Atual das Integrações

| Serviço | Cadastro Termos | Sync Dados | Serviço Configurado | Dados |
|---------|----------------|------------|---------------------|-------|
| Publicações | manage-publication-terms (SOAP) + manage-search-terms (SOAP) | sync-publications (REST) | Sim (2 serviços) | 65 publicações |
| Distribuições | manage-distribution-terms (REST V3) | sync-distributions (REST V3) | **Nao** (sem partner_service tipo distributions) | 0 registros |
| Processos | sync-process-management (REST V3) | sync-process-updates (REST V3) | Sim | 591 processos |

---

## Mudanças Propostas

### Fase 1: Reestruturação do Banco de Dados

#### 1.1 Mover `office_code` para `partners`
- Adicionar coluna `office_code` (integer) na tabela `partners`
- Migrar o valor existente (15, do cliente Infojudiciais) para o parceiro Solucionare
- O `office_code` em `client_systems` pode ser mantido temporariamente mas deixa de ser usado nas integrações

#### 1.2 Criar tabelas de junção cliente-item (consumo compartilhado)

**`client_search_terms`** - Relaciona clientes aos termos de busca (publicações e distribuições):
- `id` (uuid, PK)
- `client_system_id` (uuid, FK -> client_systems)
- `search_term_id` (uuid, FK -> search_terms)
- `created_at` (timestamp)

**`client_processes`** - Relaciona clientes aos processos monitorados:
- `id` (uuid, PK)
- `client_system_id` (uuid, FK -> client_systems)
- `process_id` (uuid, FK -> processes)
- `created_at` (timestamp)

Ambas com unique constraint em (client_system_id, search_term_id/process_id) e RLS.

#### 1.3 Atualizar `search_terms`
- Adicionar coluna `solucionare_code` (integer, nullable) para armazenar o `codNome` retornado pela Solucionare
- Isso facilita operações de editar/ativar/desativar/excluir sem precisar buscar pelo nome

### Fase 2: Lógica de Deduplicação no Cadastro

#### 2.1 Regra geral para os 3 serviços

Ao receber uma solicitação de cadastro (via API ou tela):

```text
1. Verificar se o item (termo/processo) ja existe no banco
2. SE existe:
   - Apenas criar vinculo em client_search_terms ou client_processes
   - NAO registrar na Solucionare
   - Retornar sucesso indicando "vinculado a item existente"
3. SE nao existe:
   - Registrar na Solucionare (SOAP/REST)
   - Inserir na tabela local (search_terms / processes)
   - Criar vinculo com o cliente
```

#### 2.2 Regra para remoção

```text
1. Remover vinculo do cliente (client_search_terms / client_processes)
2. Verificar se outros clientes usam o mesmo item
3. SE nenhum outro cliente usa:
   - Remover da Solucionare (SOAP/REST)
   - Desativar/remover do banco local
4. SE outros clientes usam:
   - Manter na Solucionare
   - Apenas confirmar remoção do vinculo
```

### Fase 3: Atualizar Edge Functions

#### 3.1 `manage-search-terms` (Publicações SOAP)
- Buscar `office_code` do `partners` em vez de `client_systems`
- Receber `client_system_id` como parametro
- Implementar deduplicação: verificar se termo ja existe antes de cadastrar no SOAP
- Criar vínculo em `client_search_terms`
- Na remoção, verificar se outros clientes usam o termo

#### 3.2 `manage-distribution-terms` (Distribuições REST V3)
- Receber `client_system_id` como parametro
- Implementar mesma lógica de deduplicação
- Criar vínculo em `client_search_terms`

#### 3.3 `sync-process-management` (Processos REST V3)
- Buscar `office_code` do `partners` em vez de `client_systems`
- Receber `client_system_id` como parametro
- Verificar se processo (por `process_number`) ja existe antes de registrar na Solucionare
- Criar vínculo em `client_processes`

#### 3.4 `manage-publication-terms` (Publicações SOAP - legado)
- Avaliar se pode ser consolidado com `manage-search-terms` ou mantido separado
- Aplicar mesma lógica de deduplicação

### Fase 4: Atualizar Frontend

#### 4.1 Cadastro de Parceiros (`PartnerDialog.tsx`)
- Adicionar campo `office_code` (Código do Escritório Solucionare)
- Este campo identifica o escritório concentrador de todas as APIs

#### 4.2 Cadastro de Processos (`ProcessDialog.tsx`)
- Manter seleção de cliente para vínculo
- Buscar `office_code` do parceiro (via `partner_services -> partners`)
- Verificar duplicidade antes de enviar para Solucionare

#### 4.3 Tela de Termos de Busca
- Mostrar quais clientes estão vinculados a cada termo
- Permitir vincular/desvincular clientes
- Indicar visualmente termos compartilhados entre múltiplos clientes

#### 4.4 Tela de Processos
- Mostrar quais clientes estão vinculados a cada processo
- Indicar processos compartilhados

### Fase 5: APIs Externas (Opcional neste momento)

As APIs externas (`api-processes`, `api-distributions`, `api-publications`) ja usam token de autenticação que identifica o cliente. Será necessário:
- Filtrar resultados baseado nos vínculos em `client_processes` e `client_search_terms`
- Cliente so vê processos/publicações/distribuições vinculados a ele

---

## Detalhes Técnicos

### Migration SQL (Fase 1)

```sql
-- Adicionar office_code ao parceiro
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS office_code integer;

-- Tabela de vinculo cliente <-> termos
CREATE TABLE public.client_search_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_system_id uuid NOT NULL REFERENCES public.client_systems(id) ON DELETE CASCADE,
  search_term_id uuid NOT NULL REFERENCES public.search_terms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_system_id, search_term_id)
);

-- Tabela de vinculo cliente <-> processos
CREATE TABLE public.client_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_system_id uuid NOT NULL REFERENCES public.client_systems(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_system_id, process_id)
);

-- Adicionar solucionare_code ao search_terms
ALTER TABLE public.search_terms ADD COLUMN IF NOT EXISTS solucionare_code integer;

-- RLS e indexes para as novas tabelas
-- (ambas seguem o mesmo padrao das tabelas existentes)
```

### Fluxo de Deduplicação (Exemplo: Termo de Publicação)

```text
Cliente Infojudiciais solicita termo "EMPRESA XYZ"
  -> Busca em search_terms WHERE term = "EMPRESA XYZ" AND term_type = "name"
  -> Nao encontrado
  -> Cadastra na Solucionare via SOAP (cadastrar)
  -> Insere em search_terms
  -> Insere em client_search_terms (Infojudiciais <-> termo)

Cliente Growhats solicita mesmo termo "EMPRESA XYZ"  
  -> Busca em search_terms WHERE term = "EMPRESA XYZ" AND term_type = "name"
  -> Encontrado! (id: xxx)
  -> NAO cadastra na Solucionare (economia de custo)
  -> Insere em client_search_terms (Growhats <-> termo existente)

Cliente Infojudiciais remove termo "EMPRESA XYZ"
  -> Remove de client_search_terms (Infojudiciais <-> termo)
  -> Verifica: outros clientes usam? -> Sim (Growhats)
  -> NAO remove da Solucionare
  -> Termo continua ativo

Cliente Growhats remove termo "EMPRESA XYZ"
  -> Remove de client_search_terms (Growhats <-> termo)
  -> Verifica: outros clientes usam? -> Nao
  -> Remove da Solucionare via SOAP (excluirNome)
  -> Desativa termo no banco local
```

### Ordem de Implementação

1. Migration do banco (tabelas + colunas)
2. Atualizar `PartnerDialog.tsx` com campo `office_code`
3. Atualizar as 4 Edge Functions com logica de deduplicação
4. Atualizar `ProcessDialog.tsx` para buscar `office_code` do parceiro
5. Atualizar telas de termos e processos para mostrar vinculos com clientes
6. Criar `partner_service` tipo `distributions` (configuração manual ou via tela)

### Pontos de Atenção

- Os 591 processos existentes e 9 termos existentes precisarão ser vinculados retroativamente ao cliente Infojudiciais (que é o unico ativo hoje)
- O serviço de Distribuições precisa ser configurado como `partner_service` antes de poder ser usado
- A confirmação de recebimento continua desabilitada (sistema legado é o oficial)
