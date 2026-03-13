

## Plano: Reestruturar Cadastro, Exclusão e Sincronização de Processos

### Contexto
Cada processo CNJ deve ser registrado 3x no parceiro (instâncias 1, 2, 3). A API retorna registros individuais por instância com `codProcesso` único. A exclusão usa POST com query params `codProcesso` e `codEscritorio`. A sincronização deve primeiro verificar status individual (`BuscaStatusProcesso`) e depois listar todos (`BuscaProcessos`).

### 1. Migração de banco de dados

| Ação | Detalhe |
|------|---------|
| Remover constraint UNIQUE em `process_number` | Agora haverá 3 linhas por processo (uma por instância) |
| Adicionar constraint UNIQUE em `(process_number, instance)` | Nova unicidade |
| Adicionar coluna `data_cadastro` (timestamptz) | Data de cadastro retornada pela API |
| Adicionar coluna `cod_classificacao_status` (integer) | Campo da API |
| Adicionar coluna `descricao_classificacao_status` (text) | Campo da API |

### 2. ProcessDialog (frontend) — Simplificar para etapa única

- Remover stepper (STEPS), steps 2 e 3 (Localização e Partes)
- Manter apenas: Número CNJ + Clientes
- Auto-selecionar "Infojudiciais" (buscar por nome e pré-marcar)
- Colocar Infojudiciais primeiro na listagem (sort com prioridade)
- Adicionar `Alert` informativo: "O processo será cadastrado e monitorado automaticamente nas 3 instâncias (1ª, 2ª e Superiores), caso encontrado."
- Remover campos `uf`, `instance`, `codTribunal`, `comarca`, `autor`, `reu` do form
- No submit, chamar a edge function com action `register` que internamente faz 3 chamadas
- Mostrar loading overlay como no DistributionTermDialog

### 3. Edge Function `sync-process-management` — Alterar actions

**Action `register`:**
- Receber `processNumber` e `clientSystemId`
- Fazer 3 chamadas POST `/CadastraNovoProcesso` (instância 1, 2, 3), cada uma com `{ codEscritorio, numProcesso, Instancia }`
- Inserir 3 linhas na tabela `processes` com `instance` = "1", "2", "3" e cada `cod_processo` retornado
- Vincular cada linha ao cliente via `client_processes`
- Se uma instância falhar, continuar com as outras e reportar parcialmente

**Action `delete`:**
- A API ExcluirProcesso é POST com query params: `codProcesso` e `codEscritorio`
- Buscar todas as linhas do processo (3 instâncias) e chamar ExcluirProcesso para cada `codProcesso`
- Usar `client.post('/ExcluirProcesso', null, { codProcesso, codEscritorio })` (POST sem body, com query params)

**Action `sync`:**
- Primeiro: para cada processo local com `cod_processo`, chamar `BuscaStatusProcesso?codProcesso=X` e atualizar status
- Depois: chamar `BuscaProcessos?codEscritorio=X` e fazer upsert (agora com `onConflict: 'process_number,instance'`)
- Mapear campos do retorno: `codProcesso`, `instancia`, `status`, `codClassificacaoStatus`, `descricaoClassificacaoStatus`, `dataCadastro`, `UF`, `codEscritorio`

**Action `send-pending`:**
- Ajustar para enviar 3x por processo pendente (um por instância), ou manter como está se cada linha já tem instância definida

### 4. ProcessesTable — Ajustes

- Paginação: alterar `pageSize` de 20 para 10
- Na exclusão, buscar todos os registros do mesmo `process_number` (3 instâncias) e excluir todos
- Exibir instância na tabela como já faz

### 5. ClientSelector — Priorizar Infojudiciais

- No sort dos clientes, colocar "Infojudiciais" primeiro (case-insensitive match)
- No `ProcessDialog`, auto-selecionar o ID do Infojudiciais ao abrir

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Alterar unique constraint, adicionar 3 colunas |
| `src/components/processes/ProcessDialog.tsx` | Simplificar para 1 etapa, auto-select Infojudiciais, alerta 3 instâncias, loading overlay |
| `src/components/shared/ClientSelector.tsx` | Priorizar "Infojudiciais" no sort |
| `supabase/functions/sync-process-management/index.ts` | Register 3x, delete via POST com query params, sync com BuscaStatusProcesso primeiro |
| `src/components/processes/ProcessesTable.tsx` | pageSize 10, delete multi-instância |

