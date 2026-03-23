

## Diagnóstico: Falhas na Sincronização de Andamentos, Documentos e Capas

### Causa Raiz: Timeout da Edge Function

As etapas que falham (`all-movements`, `all-documents`, `covers`) iteram **processo a processo**, fazendo uma chamada HTTP individual para cada um dos **309 processos**. Isso gera 309+ requests HTTP por etapa, facilmente ultrapassando o limite de execução da edge function (~60s).

As etapas que funcionam (`groupers`, `dependencies`) usam endpoints bulk (`PorEscritorio`) que retornam tudo em uma única chamada.

```text
Etapa                    Endpoint                              Chamadas
─────────────────────── ───────────────────────────────────── ────────
✅ Agrupadores           BuscaAgrupadoresPorEscritorio          1
✅ Dependências          BuscaDependenciasPorEscritorio          1
❌ Todos andamentos      BuscaTodosAndamentosPorProcesso        309
❌ Todos documentos      BuscaTodosDocumentosPorProcesso        309
❌ Capas                 BuscaDadosCapaProcessoPorProcesso      309
```

### Solução: Processar em lotes com paginação controlada pelo cliente

Em vez de processar todos os 309 processos em uma única invocação, o SyncProgressDialog passa a chamar a edge function em **lotes de N processos** (ex: 30), fazendo múltiplas invocações até cobrir todos.

**1. `supabase/functions/sync-process-updates/index.ts`**

Adicionar suporte a parâmetros `offset` e `limit` nas funções `syncAllMovementsByProcess`, `syncAllDocumentsByProcess` e `syncCovers`:

- Aceitar `{ syncType, offset: 0, limit: 30 }` no body
- Passar `offset`/`limit` para a query de processos (`.range(offset, offset + limit - 1)`)
- Retornar `{ results, hasMore: true/false, nextOffset }` na resposta

**2. `src/components/processes/SyncProgressDialog.tsx`**

Para as 3 etapas problemáticas, implementar um loop de paginação:

```typescript
// Pseudocódigo para cada etapa paginada
let offset = 0;
const batchSize = 30;
let totalRecords = 0;

while (true) {
  const { data } = await supabase.functions.invoke("sync-process-updates", {
    body: { syncType: stage.syncType, offset, limit: batchSize },
  });
  totalRecords += data?.results?.[0]?.recordsSynced || 0;
  if (!data?.hasMore) break;
  offset = data.nextOffset;
  // Atualizar UI com progresso parcial
}
```

**3. Atualização do progresso em tempo real**

Durante o loop, atualizar o `result` da etapa para mostrar progresso parcial (ex: "150 registros..." enquanto processa).

### Arquivos alterados
- `supabase/functions/sync-process-updates/index.ts` — suporte a offset/limit
- `src/components/processes/SyncProgressDialog.tsx` — loop paginado no client

