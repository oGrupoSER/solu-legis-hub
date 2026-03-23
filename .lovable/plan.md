

## Plano: Correção dos 3 Problemas nos Endpoints de Distribuição

### Problemas Identificados

**Problema 1: `registerName` retorna `solucionare_code: null`**
A API `/CadastrarNome` da Solucionare não retorna `codNome` na resposta de registro. O código na linha 381 tenta extrair `result?.codNome` mas o valor é `null`. Solução: após o registro bem-sucedido, chamar `/BuscaNomesCadastrados` para encontrar o nome recém-registrado e obter o `codNome`.

**Problema 2: Cursor do batch não avança após confirm**
O `confirm` apenas seta `pending_confirmation: false` no cursor. Porém, o próximo GET não exclui registros já confirmados — ele faz `SELECT * FROM distributions` filtrado por termos do cliente, sem considerar o que já foi entregue. Os mesmos 26 registros sempre voltam. Solução: no GET, excluir distribuições que já possuem entrada na tabela `record_confirmations` para aquele `client_system_id`.

**Problema 3: `term_type` inconsistente (BUG CRÍTICO)**
- `manage-distribution-terms` salva termos com `term_type = 'distribution'` (singular)
- `api-distributions` filtra por `term_type IN ['distributions', 'name', 'office']` (plural)
- Como `'distribution' ≠ 'distributions'`, o isolamento de cliente retorna 0 termos e o endpoint entrega `data: []` ou ignora o filtro. Solução: incluir `'distribution'` no filtro.

---

### Alterações

**1. `supabase/functions/manage-distribution-terms/index.ts`**
- No `registerName` (após linha 368): após registro bem-sucedido na Solucionare, chamar `BuscaNomesCadastrados` com `partnerOfficeCode` para buscar o `codNome` do nome recém-cadastrado
- Atualizar o `search_terms` local com o `solucionare_code` obtido
- Incluir `codNome` na resposta final em `data.local.solucionare_code` e `data.codNome`

**2. `supabase/functions/api-distributions/index.ts`**
- **Fix term_type** (linha 41): mudar filtro para `['distribution', 'distributions', 'name', 'office']`
- **Fix cursor/batch** (após linha 169): no GET de listagem, quando `clientSystemId` presente, excluir distribuições já confirmadas usando subquery em `record_confirmations`:
  ```sql
  -- Lógica: filtrar IDs que NÃO estão na record_confirmations para esse client
  ```
  Como o Supabase JS não suporta `NOT IN (subquery)`, buscar os IDs confirmados primeiro e usar `.not('id', 'in', confirmedIds)`

**3. Documentação de Auth na resposta** (sem mudança de código, apenas resposta ao Info):
- `api-distributions`: usa `Authorization: Bearer ljhub_*` (API Token)
- `manage-distribution-terms`: usa `Authorization: Bearer <supabase-jwt>` + `apikey: <anon-key>` (dashboard) OU `Authorization: Bearer ljhub_*` via `api-management` (sistema externo)

### Arquivos alterados
- `supabase/functions/manage-distribution-terms/index.ts`
- `supabase/functions/api-distributions/index.ts`

