

## Plano: Adicionar busca completa de andamentos por processo via `BuscaTodosAndamentosPorProcesso`

### Problema
O endpoint atual (`BuscaNovosAndamentosPorEscritorio`) só retorna andamentos **novos não confirmados**. Processos que já tiveram seus andamentos confirmados pelo sistema legado não aparecem. Além disso, o campo `textoAndamento` do retorno da API não está sendo mapeado corretamente para `description` (o código usa `mov.descricao` que não existe no payload).

### Alterações

**1. `supabase/functions/sync-process-updates/index.ts`**

- **Corrigir mapeamento** na função `syncMovements`: trocar `mov.descricao` por `mov.textoAndamento` para o campo `description`
- **Adicionar nova função `syncAllMovementsByProcess`**: após a busca por escritório, iterar sobre todos os processos cadastrados (status_code = 4) e chamar `BuscaTodosAndamentosPorProcesso?codProcesso={cod}` para cada um, fazendo upsert dos andamentos retornados
- Na seção de movements (linhas 121-139), adicionar chamada à nova função após o loop existente de `syncMovements`
- A nova função:
  1. Busca todos os processos com `cod_processo` não nulo
  2. Para cada processo, chama `GET /BuscaTodosAndamentosPorProcesso?codProcesso={codProcesso}`
  3. Mapeia os campos: `codAndamento` → `cod_andamento`, `textoAndamento` → `description`, `dataAndamento` → `data_andamento`, `codAgrupador` → `cod_agrupador`
  4. Faz upsert em `process_movements` com `onConflict: 'cod_andamento'`

**2. `src/components/processes/SyncProgressDialog.tsx`**

- Adicionar nova etapa `"all-movements"` com label "Buscando todos andamentos por processo" após a etapa `"movements"`
- Na função `runSync`, invocar `sync-process-updates` com `{ syncType: "all-movements" }` para essa etapa

### Detalhes técnicos

Nova função no edge function:
```typescript
async function syncAllMovementsByProcess(client, supabase, service): Promise<number> {
  // 1. Buscar todos os processos com cod_processo
  // 2. Para cada processo, GET /BuscaTodosAndamentosPorProcesso?codProcesso={cod}
  // 3. Upsert movimentos com campo textoAndamento → description
}
```

Mapeamento correto dos campos:
- `mov.textoAndamento` → `description` (fix do bug atual)
- `mov.codAndamento` → `cod_andamento`
- `mov.dataAndamento` → `data_andamento` / `movement_date`
- `mov.codProcesso` → lookup para `process_id`
- `mov.codAgrupador` → `cod_agrupador`

