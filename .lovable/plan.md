

## Plano: Corrigir Confirmação de Distribuições e Limpar Dados Incorretos

### Problema
O endpoint `POST confirm` na linha 87-91 busca distribuições **sem filtrar por termos do cliente** — faz `SELECT id FROM distributions ORDER BY date LIMIT 500` e confirma tudo. Resultado: 59 registros foram confirmados para o Infojudiciais, incluindo distribuições de outros clientes. Como o GET exclui IDs confirmados, as 26 distribuições reais retornam vazias.

### Correções

**1. `supabase/functions/api-distributions/index.ts` — Fix no confirm (linhas 86-105)**

Antes de buscar as distribuições para confirmar, filtrar pelos termos do cliente (mesma lógica do GET):

```typescript
// No POST confirm, após obter o cursor:
const clientTerms = await getClientTerms(authResult.clientSystemId!);
let confirmQuery = supabase.from('distributions').select('id');
if (clientTerms.length > 0) {
  confirmQuery = confirmQuery.in('term', clientTerms);
}
confirmQuery = confirmQuery.order('distribution_date', { ascending: false }).limit(batchSize);
const { data: deliveredDists } = await confirmQuery;
```

**2. Migration — Limpar confirmações incorretas**

Deletar as 59 confirmações existentes do Infojudiciais para distribuições, permitindo que o próximo GET retorne as 26 distribuições corretamente:

```sql
DELETE FROM record_confirmations 
WHERE client_system_id = '021ab6fc-2f57-4805-aa13-63d4219a12ca' 
AND record_type = 'distributions';
```

E resetar o cursor:
```sql
DELETE FROM api_delivery_cursors 
WHERE client_system_id = '021ab6fc-2f57-4805-aa13-63d4219a12ca' 
AND service_type = 'distributions';
```

### Arquivos
- `supabase/functions/api-distributions/index.ts` (fix no confirm)
- Nova migration SQL (limpeza de dados)

