

## Plano: Adicionar endpoints "Confirmar Recebimento" em Publicações e Distribuições

### 1. Publicações — Confirmar Recebimento (REST V2)

**Endpoint real**: `POST /Publicacao/publicacao_confirmarRecebimento`
- Body: array de IDs (ex: `[135040011, 479125026]`)
- Auth: Bearer tokenJWT (auto-autenticado)

**Alterações:**

**`src/pages/ApiTesting.tsx`** — Adicionar endpoint no final do array `publicationEndpoints`:
```ts
{
  id: "rest-confirmar-recebimento", label: "Confirmar Recebimento", method: "POST",
  path: "manage-search-terms", category: "management", authType: "jwt",
  description: "Confirma recebimento de publicações na API REST V2 (publicacao_confirmarRecebimento). Envie um array de IDs.",
  params: [],
  bodyParams: [
    { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    { key: "data.ids", label: "IDs das Publicações (JSON array)", placeholder: "[135040011, 479125026]", required: true },
  ],
}
```

Adicionar no `managementActionMap`: `"rest-confirmar-recebimento": "rest_confirmar_recebimento"`

**`supabase/functions/manage-search-terms/index.ts`** — Adicionar case no `handleRestV2Action`:
```ts
case 'rest_confirmar_recebimento': {
  const ids = data.ids || [];
  return await restApiCall('/Publicacao/publicacao_confirmarRecebimento', 'POST', tokenJWT, ids, service.id, null);
}
```

Adicionar `'rest_confirmar_recebimento'` ao type union de `ManageRequest.action`.

---

### 2. Distribuições — Confirmar Recebimento (REST V3)

**Endpoint real**: `POST /distribuicoes/ConfirmaRecebimentoDistribuicoes?codEscritorio=41`
- Body: `{ "distribuicoes": [{ "codEscritorio": 41, "codProcesso": 195148028 }, ...] }`
- Auth: Bearer token (auto-autenticado)

**Alterações:**

**`src/pages/ApiTesting.tsx`** — Adicionar endpoint no final do array `distributionEndpoints`:
```ts
{
  id: "dis-confirmar-recebimento", label: "Confirmar Recebimento", method: "POST",
  path: "manage-distribution-terms", category: "management", authType: "jwt",
  description: "Confirma recebimento de distribuições na API V3 (ConfirmaRecebimentoDistribuicoes).",
  params: [],
  bodyParams: [
    { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    { key: "distribuicoes", label: "Distribuições (JSON array)", placeholder: '[{"codEscritorio": 41, "codProcesso": 195148028}]', required: true },
  ],
}
```

Adicionar no `managementActionMap`: `"dis-confirmar-recebimento": "confirmDistributions"`

**`supabase/functions/manage-distribution-terms/index.ts`** — Adicionar case `confirmDistributions` no switch:
```ts
case 'confirmDistributions': {
  const { distribuicoes, codEscritorio: codEsc } = params;
  if (!distribuicoes) throw new Error('distribuicoes array is required');
  const distList = typeof distribuicoes === 'string' ? JSON.parse(distribuicoes) : distribuicoes;
  result = await apiRequest(service.service_url, `/ConfirmaRecebimentoDistribuicoes?codEscritorio=${codEsc || officeCode}`, jwtToken, 'POST', { distribuicoes: distList });
  break;
}
```

---

### Arquivos alterados
- `src/pages/ApiTesting.tsx` — 2 novos endpoints + 2 entradas no actionMap
- `supabase/functions/manage-search-terms/index.ts` — 1 novo case + type union
- `supabase/functions/manage-distribution-terms/index.ts` — 1 novo case

