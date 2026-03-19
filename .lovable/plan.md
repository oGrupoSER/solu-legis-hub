

## Plano: Rotear TODOS os endpoints de Processo via api-management com API Token

### Problema
Apenas 3 endpoints de processo (register, delete, status) foram migrados para `api-management` com Token. Os demais 17 endpoints (list, sync, send-pending, e todos os REST V3 — agrupadores, andamentos, dependências, documentos, capa, etc.) ainda apontam para `sync-process-management` com JWT, impedindo integração externa.

### Alterações

**1. `supabase/functions/api-management/index.ts`** — Adicionar proxy para as ações restantes de processo:

Novas ações que delegam para `sync-process-management` via `callInternalFunction`:
- `list-processes-registered` → action `list`
- `resend-pending-processes` → action `send-pending`  
- `sync-processes` → action `sync`
- Todas as ações `rest_*` (20 ações REST V3): `rest_cadastrar_processo`, `rest_excluir_processo`, `rest_buscar_status`, `rest_buscar_processos`, `rest_buscar_novos_agrupadores`, etc.

Implementação: um bloco genérico que detecta ações começando com `rest_` ou as 3 ações novas e faz proxy:
```text
case 'list-processes-registered':
case 'resend-pending-processes':
case 'sync-processes':
  → callInternalFunction('sync-process-management', { action: mapped, serviceId, ...data })

default (se action.startsWith('rest_')):
  → callInternalFunction('sync-process-management', { action, serviceId, ...data })
```

**2. `src/pages/ApiTesting.tsx`** — Atualizar TODOS os 17 endpoints restantes:
- `path`: `"sync-process-management"` → `"api-management"`
- `authType`: `"jwt"` → `"token"`
- `bodyParams`: prefixar com `data.` (ex: `data.serviceId` → `data.service_id`, `data.codEscritorio`, `data.codProcesso`, etc.)
- Atualizar `managementActionMap` para mapear os IDs aos nomes de ação corretos no proxy

**3. `src/lib/playground-export.ts`** — Os endpoints já serão pegos automaticamente pela lógica existente (usam `api-management` com token).

### Endpoints afetados (17)

| ID | Ação no proxy |
|---|---|
| list-registered-processes | list |
| resend-pending-processes | send-pending |
| sync-processes | sync |
| and-cadastrar-processo | rest_cadastrar_processo |
| and-excluir-processo | rest_excluir_processo |
| and-buscar-status | rest_buscar_status |
| and-buscar-processos | rest_buscar_processos |
| and-buscar-novos-agrupadores | rest_buscar_novos_agrupadores |
| and-buscar-agrupadores-escritorio | rest_buscar_agrupadores_escritorio |
| and-confirmar-agrupador | rest_confirmar_agrupador |
| and-buscar-novas-dependencias | rest_buscar_novas_dependencias |
| and-buscar-dependencias-escritorio | rest_buscar_dependencias_escritorio |
| and-confirmar-dependencia | rest_confirmar_dependencia |
| and-buscar-novos-andamentos | rest_buscar_novos_andamentos |
| and-buscar-andamentos-escritorio | rest_buscar_andamentos_escritorio |
| and-confirmar-andamento | rest_confirmar_andamento |
| and-buscar-capa | rest_buscar_capa |
| and-buscar-novos-documentos | rest_buscar_novos_documentos |
| and-buscar-documentos-escritorio | rest_buscar_documentos_escritorio |
| and-confirmar-documento | rest_confirmar_documento |
| and-todos-andamentos-processo | rest_todos_andamentos_processo |
| and-todos-agrupadores-processo | rest_todos_agrupadores_processo |
| and-todos-documentos-processo | rest_todos_documentos_processo |
| and-processos-cadastrados | rest_processos_cadastrados |
| and-qtd-andamentos | rest_qtd_andamentos |

### Resultado
Todos os endpoints da aba Processos no Playground usarão API Token via `api-management`, sem exceção. O Info poderá consumir qualquer operação de processo com `ljhub_...`.

### Arquivos alterados
- `supabase/functions/api-management/index.ts`
- `src/pages/ApiTesting.tsx`

