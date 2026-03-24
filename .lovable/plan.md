

## Plano: Corrigir CORS do sync-publications

### Problema
O `corsHeaders` na linha 17-20 do `supabase/functions/sync-publications/index.ts` não inclui os headers `x-supabase-client-*` que o SDK Supabase envia automaticamente. O browser bloqueia a requisição preflight e retorna "NetworkError".

### Correção

**`supabase/functions/sync-publications/index.ts`** — Linha 17-20

Atualizar os CORS headers para o padrão completo:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

### Arquivo alterado
- `supabase/functions/sync-publications/index.ts` (linha 19)

