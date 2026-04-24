## Problema
Após sincronizar em `/distributions/terms`, aparecem mais nomes do que os 2 retornados pela API `BuscaNomesCadastrados`. Isso ocorre porque a função `sync-distributions` (acionada pela sincronização de dados de distribuições) extrai `nomePesquisado` de cada distribuição recebida e re-insere como `search_term` no banco — poluindo a lista de termos que deveria espelhar fielmente o parceiro.

## Causa
`supabase/functions/sync-distributions/index.ts` chama `syncTermsFromDistributions(...)` (linha ~109) após receber distribuições. Essa função (linhas ~197-233) faz `INSERT` em `search_terms` para cada `nomePesquisado` único — recriando termos que foram deliberadamente excluídos no parceiro.

## Correção
**`supabase/functions/sync-distributions/index.ts`**:
- Remover a chamada `await syncTermsFromDistributions(supabase, service, distributions);` (linha ~109).
- Remover a definição completa da função `syncTermsFromDistributions` (linhas ~197-233).
- Manter apenas a inserção em `distributions` (dados brutos das distribuições recebidas).

A página `/distributions/terms` continuará usando `manage-distribution-terms` (action `listNames`) como única fonte de verdade — espelhando fielmente o `BuscaNomesCadastrados` do parceiro com orphan cleanup.

## Resultado
Após o deploy, a sincronização de distribuições populará apenas a tabela `distributions` (dados recebidos), e a lista de termos refletirá exatamente os 2 nomes cadastrados no parceiro.