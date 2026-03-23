

## Plano: Suporte a Token via Query Param no api-distributions

### Problema
O Infojudiciais envia o token `ljhub_*` como query parameter (`?token=ljhub_...`), mas o `auth-middleware.ts` só lê do header `Authorization: Bearer <token>`.

### Solução
Atualizar o `auth-middleware.ts` para também aceitar token via query parameter `token`, como fallback quando o header Authorization não está presente.

### Alteração

**`supabase/functions/_shared/auth-middleware.ts`** — na função `validateToken`:
- Antes de retornar erro por header ausente, verificar `url.searchParams.get('token')`
- Se encontrado, usar esse valor como o token
- Manter o header `Authorization: Bearer` como método primário

```
// Lógica atual:
const authHeader = request.headers.get('Authorization');
// token = authHeader.substring(7)

// Nova lógica:
const authHeader = request.headers.get('Authorization');
let token = '';
if (authHeader && authHeader.startsWith('Bearer ')) {
  token = authHeader.substring(7);
} else {
  // Fallback: query param
  const url = new URL(request.url);
  token = url.searchParams.get('token') || '';
}
if (!token) {
  return { authenticated: false, error: 'Missing token. Send via Authorization: Bearer <token> header or ?token= query param' };
}
```

### Instrução para o Infojudiciais
Formato correto da chamada:

**Opção 1 (recomendada) — Header:**
```
Authorization: Bearer ljhub_xxxxx
apikey: <anon_key>
```

**Opção 2 (fallback) — Query param:**
```
GET /functions/v1/api-distributions?token=ljhub_xxxxx&limit=500
apikey: <anon_key>
```

### Arquivo alterado
- `supabase/functions/_shared/auth-middleware.ts`

