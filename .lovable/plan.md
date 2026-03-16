

## Diagnóstico: 401 no `manage-search-terms`

O problema é simples: no `supabase/config.toml`, a função `manage-search-terms` está com `verify_jwt = true`. Isso faz o gateway do backend rejeitar qualquer request que não tenha um JWT válido do sistema de autenticação — incluindo o API Token do Infojudiciais (`ljhub_...`). O 401 acontece **antes** do código da função executar.

Compare com `api-processes`, `api-distributions`, `api-publications` e `api-management` — todos têm `verify_jwt = false` e fazem validação interna.

### Correção

**1. `supabase/config.toml`** — Mudar para `verify_jwt = false`:
```toml
[functions.manage-search-terms]
verify_jwt = false
```

**2. `supabase/functions/manage-search-terms/index.ts`** — Adicionar validação de autenticação no código, igual aos outros endpoints da API:
- Importar `validateToken` do `auth-middleware.ts`
- No handler principal, antes de processar a action, validar o token via `validateToken(req)`
- Aceitar tanto JWT de admin (usuários logados no Hub) quanto API Token (sistemas externos como Infojudiciais)
- Se não autenticado, retornar 401 com mensagem clara

### Arquivos alterados
- `supabase/config.toml` — `verify_jwt = false`
- `supabase/functions/manage-search-terms/index.ts` — adicionar validação de token no handler

