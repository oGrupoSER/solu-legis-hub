

## Plano: Botão "Verificar Status" Importa Todos os Processos do Escritório 41

### Situação Atual

O botão já chama `sync` que faz `BuscaProcessos?codEscritorio=41` e upsert — mas:
1. **312 upserts individuais** causam timeout (~81s)
2. O bulk `BuscaProcessos` não retorna todos os processos (alguns recém-cadastrados ficam de fora)
3. Processos que existem na Solucionare mas não aparecem no bulk nunca são importados

### Correções

**1. `supabase/functions/sync-process-management/index.ts` — ação `sync`**

- **Batch upserts**: Acumular registros e fazer upsert em lotes de 50, reduzindo de ~312 chamadas individuais para ~7 chamadas batch
- **Varredura de pendentes**: Após o bulk, buscar processos locais com `cod_processo` que não foram atualizados nesta execução (`updated_at < syncStart`), e consultar individualmente via `BuscaStatusProcesso` (limite 50 por execução). Filtrar resultado pelo `codEscritorio=41`. Atualizar status local.

```typescript
// 1. Batch upserts (substituir loop individual)
const batchSize = 50;
let batch = [];
for (const proc of filtered) {
  batch.push(upsertData);
  if (batch.length >= batchSize) {
    await supabase.from('processes').upsert(batch, { onConflict: 'process_number,instance' });
    batch = [];
  }
}
if (batch.length > 0) await supabase.from('processes').upsert(batch, { onConflict: '...' });

// 2. Varredura individual de processos não cobertos pelo bulk
const { data: missed } = await supabase.from('processes')
  .select('id, cod_processo, process_number, instance')
  .not('cod_processo', 'is', null)
  .lt('updated_at', syncStart)
  .limit(50);

for (const proc of missed) {
  const status = await client.get('/BuscaStatusProcesso', { codProcesso: proc.cod_processo, codEscritorio: officeCode });
  // Filtrar por codEscritorio=41, atualizar registro
}
```

### Arquivo alterado
- `supabase/functions/sync-process-management/index.ts` — batch upserts + varredura de pendentes na ação `sync`

