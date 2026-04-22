

## Plano: Corrigir erro "solCode is not defined" no cadastro de termos de distribuição

### Problema

No `manage-distribution-terms/index.ts`, ação `registerName`:

1. **Bug de escopo (causa do erro)**: A variável `solCode` é declarada com `let` dentro do bloco `else` (linha 381), mas é usada fora dele na linha 417 (`result = { ..., codNome: solCode, ... }`). Quando o termo já existe localmente (`existing` é truthy), o código pula o bloco `else` e ao tentar montar o `result` lança `ReferenceError: solCode is not defined`.

2. **Default errado de instâncias**: Linha 337 usa `listInstancias: listInstancias || [4]` como fallback no metadata. Conforme a nova especificação do parceiro, o padrão correto é `[1, 2, 3]` (1º grau, 2º grau e Superior). Já está correto na construção do `requestBody` (linha 351), mas o metadata persistido fica errado.

### Correções em `supabase/functions/manage-distribution-terms/index.ts`

**1.** Declarar `solCode` no escopo da ação (antes do `if (existing)`), para que esteja sempre definido:

```typescript
let solCode: number | null = existing?.solucionare_code ?? null;
```

**2.** Remover a redeclaração `let solCode = result?.codNome || null;` na linha 381 — usar atribuição: `solCode = result?.codNome || solCode;`

**3.** Trocar o default `[4]` por `[1, 2, 3]` na linha 337.

### Arquivo alterado
- `supabase/functions/manage-distribution-terms/index.ts` (linhas 320-417 da ação `registerName`)

