

## Plano: Ajustar exclusão de processos

### Problema atual
A exclusão já chama o endpoint `ExcluirProcesso` com `codProcesso` e `codEscritorio` via POST com query params -- isso esta correto. Porem:

1. **Frontend usa `confirm()` nativo** em vez do padrão `AlertDialog` do projeto
2. **Edge function nao limpa tabelas dependentes** (groupers, movements, documents, covers, parties, lawyers, dependencies) antes de excluir o processo

### Alteracoes

**1. `ProcessesTable.tsx`** -- Substituir `confirm()` por `AlertDialog` com mensagem explicativa de que a exclusao remove o processo tanto localmente quanto no parceiro, para todas as instancias.

**2. `sync-process-management/index.ts` (action `delete`)** -- Antes de deletar cada processo, limpar na ordem:
- `process_documents` (by `process_id`)
- `process_movements` (by `process_id`)
- `process_lawyers` (by `process_id`)
- `process_parties` (by `process_id`)
- `process_covers` (by `process_id`)
- `process_groupers` (by `process_id`)
- `process_dependencies` (by `process_id`)
- `client_processes` (by `process_id`) -- ja existe
- `processes` (by `id`) -- ja existe

### Arquivos afetados
| Arquivo | Mudanca |
|---------|---------|
| `src/components/processes/ProcessesTable.tsx` | AlertDialog em vez de confirm() |
| `supabase/functions/sync-process-management/index.ts` | Limpar tabelas dependentes no delete |

