

## Plano: Corrigir Cadastro de Termos de Distribuição via Playground e API Externa

### Problema
Quando o "Cadastrar Termo" de distribuições é chamado via Playground ou via API externa (Info → `api-management`), os campos `listInstancias` e `listAbrangencias` não são enviados. A edge function usa defaults incorretos/vazios, resultando em falha no cadastro na Solucionare.

A tela `/distributions/terms` funciona porque injeta `listInstancias: [4]` e `FIXED_ABRANGENCIAS` hardcoded antes de chamar a edge function. Mas o Playground e a API externa não fazem isso.

### Correção

**1. `supabase/functions/manage-distribution-terms/index.ts`** — Garantir defaults corretos no `registerName`
- Linha 337: `listInstancias` default deve ser `[4]` (já está)
- Linha 338: `listAbrangencias` default deve ser `DEFAULT_ABRANGENCIAS` em vez de array vazio
- Linha 354: A conversão `[4] → [1,2,3]` deve mudar para enviar `[1, 2, 3]` diretamente como valor padrão
- Linha 279 (api-management): `listInstancias` default deve ser `[4]` e `abrangencias` deve usar a lista completa

**2. `supabase/functions/api-management/index.ts`** — Corrigir defaults no `register-dist-term`
- Linha 279: `listInstancias` default de `[1]` → `[4]`
- Linha 280: `abrangencias` default de `[]` → lista completa `DEFAULT_ABRANGENCIAS`
- Importar/definir `DEFAULT_ABRANGENCIAS` neste arquivo

**3. `src/pages/ApiTesting.tsx`** — Adicionar `listInstancias` e `abrangencias` como campos visíveis (readonly/pré-preenchidos) no endpoint `dis-cadastrar-termo`
- Adicionar `listInstancias` como bodyParam com placeholder `[4]` (informativo)
- Não adicionar `abrangencias` visualmente (muito longo), mas documentar na description que é preenchido automaticamente

**4. `src/lib/playground-export.ts`** — No export Postman, injetar `listInstancias: [4]` e a lista completa de `listAbrangencias` no body do "Cadastrar Termo"
- Tratar o endpoint `dis-cadastrar-termo` como caso especial no `buildPostmanItem`, adicionando esses campos ao body exportado

### Resultado
- Playground: ao executar "Cadastrar Termo", o registro chega corretamente à Solucionare
- API externa (Info): ao chamar `register-dist-term`, os defaults são preenchidos automaticamente
- Export Postman: o body já vem com `listInstancias` e `listAbrangencias` preenchidos

### Arquivos alterados
- `supabase/functions/manage-distribution-terms/index.ts`
- `supabase/functions/api-management/index.ts`
- `src/pages/ApiTesting.tsx`
- `src/lib/playground-export.ts`

