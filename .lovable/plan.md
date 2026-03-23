

## Plano: Limpar Processos COD-* e Impedir Importação Automática

### Problema
O `sync-processes` importa automaticamente todos os ~2.261 processos cadastrados na Solucionare, criando placeholders `COD-xxxxx`. Esses processos nunca foram cadastrados pelo usuário — foram importados em massa.

### Correções

**1. Migration SQL — Deletar os 2.261 processos COD-***

```sql
DELETE FROM processes WHERE process_number LIKE 'COD-%';
```

Isso remove apenas os placeholders importados automaticamente. Processos cadastrados manualmente (com número CNJ real) permanecem intactos.

**2. `supabase/functions/sync-processes/index.ts` — Remover a lógica de auto-criação**

Alterar a função para que ela apenas **atualize o status** de processos que já existem localmente (cadastrados pelo Hub ou pelo Infojudiciais), sem criar novos registros. A lógica do loop (linhas 103-130) será alterada de:

- "Se não existe, cria placeholder" → "Se existe localmente, atualiza `cod_processo` se necessário"

O sync passa a ser apenas uma verificação de paridade, não um importador.

### Arquivos alterados
- `supabase/functions/sync-processes/index.ts`
- Nova migration SQL (DELETE dos COD-*)

