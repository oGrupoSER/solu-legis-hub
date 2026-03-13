

## Plano: Excluir deve desativar (não deletar) o termo de distribuição

### Problema
Atualmente, ao clicar em "Excluir" em `/distributions/terms`, o sistema chama `/ExcluirNome` (DELETE) na API e remove o registro local. O correto é chamar `/DesativarNome` (POST com `codNome`) e apenas marcar `is_active = false` localmente.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/manage-distribution-terms/index.ts` | No case `deleteName`: trocar chamada `/ExcluirNome` (DELETE) por `/DesativarNome` (POST com `{ codNome }`) e fazer `update is_active = false` em vez de deletar |
| `src/pages/DistributionTerms.tsx` | No `deleteMutation`: em vez de deletar registros locais (`search_terms`, `client_search_terms`), apenas fazer `update is_active = false`. Alterar label/toast de "Excluir" para "Desativar" |

### Edge Function — case `deleteName`
- Substituir `apiRequest(url, '/ExcluirNome', token, 'DELETE', { codNome })` por `apiRequest(url, '/DesativarNome', token, 'POST', { codNome })`
- Em vez de `delete` no `search_terms`, fazer `update({ is_active: false })`
- Manter `client_search_terms` intactos

### UI — `deleteMutation`
- Remover `supabase.from("search_terms").delete()` e `supabase.from("client_search_terms").delete()`
- Após chamar a edge function, fazer `update({ is_active: false })` no `search_terms`
- Alterar rótulos: "Excluir" → "Desativar", toast "removido" → "desativado"
- Alterar ícone/cor do botão para refletir desativação em vez de exclusão

