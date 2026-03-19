

## Plano: Rotear endpoints de Processo via api-management com API Token

### Problema
Os endpoints de gerenciamento de processos no Playground (`register-process`, `delete-process`, `status-process`) apontam para `sync-process-management` com `authType: "jwt"`. Quando o Info tenta consumir, não funciona porque usa API Token (`ljhub_...`), não JWT de sessão.

As ações de processo já existem no `api-management` (register-process, delete-process — linhas 354-451), que aceita API Token. O Playground só precisa apontar para lá.

### Alterações

**1. `src/pages/ApiTesting.tsx`** — Atualizar os 3 endpoints de processo de alto nível:

| Endpoint | Antes | Depois |
|---|---|---|
| `register-process` | `path: "sync-process-management"`, `authType: "jwt"` | `path: "api-management"`, `authType: "token"` |
| `delete-process` | `path: "sync-process-management"`, `authType: "jwt"` | `path: "api-management"`, `authType: "token"` |
| `status-process` | `path: "sync-process-management"`, `authType: "jwt"` | `path: "api-management"`, `authType: "token"` |

- Ajustar `bodyParams` para usar a estrutura do `api-management` (campos dentro de `data: { ... }`)
  - `register-process`: `data.processNumber`, `data.service_id`
  - `delete-process`: `data.processNumber`, `data.service_id`
  - `status-process`: `data.processNumber`, `data.service_id`
- Atualizar `managementActionMap` para mapear os IDs corretos
- Os endpoints REST V3 diretos (and-cadastrar-processo, etc.) permanecem como JWT — são ferramentas internas

**2. `src/pages/ApiTesting.tsx` (buildBody)** — Garantir que endpoints `api-management` de processos usem a estrutura `{ action, data: { ... } }` (mesma lógica já usada para `manage-search-terms`)

**3. Code examples** — O badge muda de "JWT" para "Token" nos 3 endpoints, e o curl/JS/Python mostrarão `SEU_TOKEN` em vez de `SEU_JWT_TOKEN`

### Endpoints que NÃO mudam
Os endpoints REST V3 diretos (and-cadastrar-processo, and-buscar-status, etc.) continuam via `sync-process-management` com JWT — são endpoints internos de diagnóstico, não consumidos pelo Info.

### Resultado
O Info poderá chamar `api-management` com API Token para cadastrar, excluir e consultar status de processos, exatamente como já faz para publicações e distribuições.

