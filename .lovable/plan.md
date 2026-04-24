## Alterações em `src/pages/ApiTesting.tsx`

### 1. `dis-desativar-termo`
- Trocar `method: "POST"` → `method: "PATCH"` (reflete o verbo real da chamada Solucionare `DesativarNome`).
- Manter `bodyParams`: `serviceId` + `codNome`. `nomeRelacional` (ORBO) e `token` continuam sendo injetados pelo edge function.

### 2. Novo endpoint `dis-excluir-termo`
```ts
{
  id: "dis-excluir-termo",
  label: "Excluir Termo",
  method: "DELETE",
  path: "manage-distribution-terms",
  category: "management",
  authType: "jwt",
  description: "Exclui um nome/termo de distribuição na Solucionare (ExcluirNome). nomeRelacional e token injetados automaticamente.",
  params: [],
  bodyParams: [
    { key: "serviceId", label: "ID do Serviço", required: true },
    { key: "codNome", label: "Código do Nome (Solucionare)", placeholder: "83379", required: true, type: "number" },
  ],
}
```

### 3. `managementActionMap`
Adicionar:
```ts
"dis-excluir-termo": "deleteName",
```

## Verificação no edge function
`supabase/functions/manage-distribution-terms/index.ts` já implementa a action `deleteName` corretamente (linhas 484-506):
- Usa `DELETE /ExcluirNome` com body `{ codNome }`
- `apiRequest` injeta automaticamente `nomeRelacional` e `token`
- Aplica lógica de deduplicação (só remove na Solucionare se nenhum outro cliente Hub usar)

Nenhuma alteração no edge function é necessária.

## Arquivo alterado
- `src/pages/ApiTesting.tsx`