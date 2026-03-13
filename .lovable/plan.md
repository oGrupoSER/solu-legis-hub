

## Plano: Corrigir vinculação de documentos aos andamentos

### Problema raiz
O arquivo `sync-process-updates/index.ts` tem um **bug estrutural grave**: a função `syncAllDocumentsByProcess` (linhas 538-609) está definida **dentro** da função `syncAllMovementsByProcess` (que deveria fechar na linha 531 mas não fecha). As chaves de fechamento estão invertidas (linhas 611-616 pertencem a `syncAllMovementsByProcess`). Isso faz com que:
1. `syncAllMovementsByProcess` nunca retorne corretamente
2. `syncAllDocumentsByProcess` nunca seja executada como função independente
3. A etapa "all-documents" do sync retorna 0 registros

### Alteração

**1. `supabase/functions/sync-process-updates/index.ts`**

Corrigir a estrutura de funções:
- Fechar `syncAllMovementsByProcess` corretamente na linha 531 (adicionar `return totalSynced; } catch ... }`)
- Remover as linhas 611-616 (o return/catch/closing duplicados)
- Garantir que `syncAllDocumentsByProcess` fique como função independente no escopo global do módulo

A lógica de lookup de `movement_id` via `movementMap` já existe nas linhas 566-576 e está correta. O problema é puramente estrutural -- as funções estão aninhadas incorretamente.

### Resultado esperado
Após o fix, ao sincronizar:
- `syncAllMovementsByProcess` salva todos os andamentos
- `syncAllDocumentsByProcess` roda independentemente, busca documentos, e vincula `movement_id` quando `codAndamento` corresponde a um andamento existente
- A coluna "Docs" na aba de andamentos em `/processes/movements` mostrará a contagem correta de documentos por andamento

