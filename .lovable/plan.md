

## Plano: Sincronização com Loading em Etapas + Busca Completa de Dados

### Contexto
O botão "Sincronizar" em `/processes` precisa executar múltiplas etapas com feedback visual em tempo real. A edge function `sync-process-updates` já existe com toda a lógica, mas precisa ser chamada por etapas individuais para que o frontend mostre o progresso.

### 1. Frontend — Componente `SyncProgressDialog`

Novo componente `src/components/processes/SyncProgressDialog.tsx`:
- Dialog modal que aparece ao clicar em "Sincronizar"
- Lista de etapas com ícones de status (pendente ⏳, executando 🔄, concluído ✅, erro ❌)
- Cada etapa mostra quantidade de registros processados ao concluir
- Botão "Fechar" só habilitado quando todas etapas terminarem
- Não permite fechar durante execução (mesmo padrão do DistributionTerms)

Etapas exibidas:
1. "Enviando processos pendentes" → action `send-pending`
2. "Atualizando status dos processos" → sync-process-management action `sync` (que faz BuscaStatusProcesso + BuscaProcessos)
3. "Buscando agrupadores" → sync-process-updates syncType `groupers`
4. "Buscando andamentos" → sync-process-updates syncType `movements`
5. "Buscando documentos" → sync-process-updates syncType `documents`
6. "Atualizando capas dos processos" → sync-process-updates syncType `covers`
7. "Buscando dependências" → sync-process-updates syncType `dependencies`

### 2. `Processes.tsx` — Alterar handleSync

- Remover lógica inline de sync
- Abrir `SyncProgressDialog` que executa as etapas sequencialmente
- Cada etapa chama a edge function correspondente e atualiza o estado visual
- Ao finalizar, fazer `setRefreshTrigger` para atualizar a tabela

### 3. Edge Function `sync-process-updates` — Ajustes nos endpoints

A função já suporta `syncType` individual (groupers, movements, documents, covers, dependencies). Ajustes:

| Endpoint atual | Endpoint correto (user spec) |
|---|---|
| `BuscaNovosAndamentosPorEscritorio` | `BuscaNovosAndamentos` (manter PorEscritorio — já funciona, user deu exemplo sem mas a lógica PorEscritorio é a correta por isolamento) |
| `BuscaProcessosComCapaAtualizada` + `BuscaDadosCapaEStatusVariosProcessos` | Adicionar lógica alternativa: para cada processo CADASTRADO local com `cod_processo`, chamar `BuscaDadosCapaProcessoPorProcesso?codProcesso=X` |
| Documentos sem `codAndamento` | Já tratado pelo `linkOrphanDocuments` — documentos sem codAndamento ficam vinculados ao processo via `process_id` |

Alterações na função `syncCovers`:
- Para cada processo local com `cod_processo` e `status_code = 4`, chamar `GET /BuscaDadosCapaProcessoPorProcesso?codProcesso=X`
- O retorno é um array com dados completos incluindo autor, réu, advogados
- Upsert em `process_covers`, `process_parties`, `process_lawyers`

### 4. Migração — Colunas faltantes em `process_covers`

Adicionar à tabela `process_covers`:
- `digital` (boolean)
- `link_consulta_processo` (text)
- `sigla_sistema` (text)
- `nome_sistema` (text)
- `cod_sistema` (integer)

### 5. Documentos sem `codAndamento`

A lógica já existe: documentos com `codAndamento` nulo e `codProcesso` preenchido são vinculados ao processo via `process_id`. Na tab "Documentos" do processo, esses documentos já aparecem pois o filtro é `process_id = X`.

Filtro adicional: garantir que apenas documentos com `codEscritorio = 41` (office_code do parceiro) sejam importados. Adicionar filtro no `syncDocuments`.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/processes/SyncProgressDialog.tsx` | **Novo** — Dialog com checklist de progresso por etapa |
| `src/pages/Processes.tsx` | Substituir handleSync por abertura do SyncProgressDialog |
| `supabase/functions/sync-process-updates/index.ts` | Alterar `syncCovers` para usar `BuscaDadosCapaProcessoPorProcesso`, filtrar documentos por codEscritorio, salvar novas colunas |
| Migration SQL | Adicionar 5 colunas em `process_covers` |

