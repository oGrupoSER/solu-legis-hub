

## Plano: Limpar base de processos e tabelas vinculadas

### Dados atuais
| Tabela | Registros |
|--------|-----------|
| processes | 20 |
| process_movements | 0 |
| process_covers | 0 |
| process_parties | 2 |
| process_lawyers | 4 |
| process_documents | 131 |
| process_groupers | 13 |
| process_dependencies | 15 |
| client_processes | 13 |

### Ação
Executar DELETEs nas tabelas dependentes primeiro (para evitar problemas de FK), depois na tabela `processes`:

1. `client_processes` — vínculos de clientes
2. `process_lawyers` — advogados
3. `process_parties` — partes
4. `process_documents` — documentos (+ limpar storage bucket `process-documents`)
5. `process_dependencies` — dependências
6. `process_groupers` — agrupadores
7. `process_covers` — capas
8. `process_movements` — andamentos
9. `processes` — processos

Todas as operações via insert tool (DELETE de dados, não alteração de schema).

