

## Plano: Adicionar endpoints de Andamentos V3 na categoria Processos

### Resumo
Adicionar 20 novos endpoints REST V3 de Andamentos ao array `processEndpoints` no Playground, sem prefixo "And - ", com os métodos corretos (GET/POST). Também adicionar os mapeamentos de ação correspondentes no `managementActionMap`.

### Endpoints a adicionar (em `src/pages/ApiTesting.tsx`)

Todos usam `path: "sync-process-management"`, `category: "management"`, `authType: "jwt"`.

| ID | Label | Method | Action | Body Params |
|---|---|---|---|---|
| `and-cadastrar-processo` | Cadastrar Processo | POST | `rest_cadastrar_processo` | serviceId, codEscritorio, numProcesso, Instancia |
| `and-excluir-processo` | Excluir Processo | POST | `rest_excluir_processo` | serviceId, codProcesso, codEscritorio |
| `and-buscar-status` | Buscar Status do Processo | GET | `rest_buscar_status` | serviceId, codProcesso |
| `and-buscar-processos` | Buscar Processos | GET | `rest_buscar_processos` | serviceId, codEscritorio |
| `and-buscar-novos-agrupadores` | Buscar Novos Agrupadores | GET | `rest_buscar_novos_agrupadores` | serviceId, codEscritorio |
| `and-buscar-agrupadores-escritorio` | Buscar Agrupadores Por Escritório | GET | `rest_buscar_agrupadores_escritorio` | serviceId, codEscritorio |
| `and-confirmar-agrupador` | Confirmar Recebimento Agrupador | POST | `rest_confirmar_agrupador` | serviceId, codEscritorio, codAgrupador |
| `and-buscar-novas-dependencias` | Buscar Novas Dependências | GET | `rest_buscar_novas_dependencias` | serviceId, codEscritorio |
| `and-buscar-dependencias-escritorio` | Buscar Dependências Por Escritório | GET | `rest_buscar_dependencias_escritorio` | serviceId, codProcesso, codEscritorio |
| `and-confirmar-dependencia` | Confirmar Recebimento Dependências | POST | `rest_confirmar_dependencia` | serviceId, codEscritorio, codDependencia |
| `and-buscar-novos-andamentos` | Buscar Novos Andamentos | GET | `rest_buscar_novos_andamentos` | serviceId, codEscritorio |
| `and-buscar-andamentos-escritorio` | Buscar Andamentos Por Escritório | GET | `rest_buscar_andamentos_escritorio` | serviceId, codEscritorio |
| `and-confirmar-andamento` | Confirmar Recebimento de Andamentos | POST | `rest_confirmar_andamento` | serviceId, codEscritorio, codAndamento, codProcesso, codAgrupador |
| `and-buscar-capa` | Busca Capa por Processo | GET | `rest_buscar_capa` | serviceId, codProcesso |
| `and-buscar-novos-documentos` | Buscar Novos Documentos | GET | `rest_buscar_novos_documentos` | serviceId |
| `and-buscar-documentos-escritorio` | Buscar Documentos Escritório | GET | `rest_buscar_documentos_escritorio` | serviceId, codEscritorio |
| `and-confirmar-documento` | Confirmar Recebimento Documento | POST | `rest_confirmar_documento` | serviceId, codEscritorio, codDocumento |
| `and-todos-andamentos-processo` | Todos Andamentos por Processo | GET | `rest_todos_andamentos_processo` | serviceId, codProcesso |
| `and-todos-agrupadores-processo` | Todos Agrupadores por Processo | GET | `rest_todos_agrupadores_processo` | serviceId, codProcesso |
| `and-todos-documentos-processo` | Todos Documentos por Processo | GET | `rest_todos_documentos_processo` | serviceId, codProcesso |
| `and-processos-cadastrados` | Processos Cadastrados | GET | `rest_processos_cadastrados` | serviceId, codEscritorio |
| `and-qtd-andamentos` | QTD Andamentos Disponíveis | GET | `rest_qtd_andamentos` | serviceId, codEscritorio |

### Alterações necessárias

**1. `src/pages/ApiTesting.tsx`:**
- Adicionar os 22 endpoints acima ao array `processEndpoints` (após os existentes, na seção "management")
- Adicionar os 22 mapeamentos no `managementActionMap`

**2. `supabase/functions/sync-process-management/index.ts`:**
- Adicionar handler para actions `rest_*` que faz proxy direto para a API V3 do parceiro (similar ao padrão já usado em `manage-search-terms`)
- O handler recebe `serviceId`, busca config do parceiro, cria RestClient e chama o endpoint correspondente
- Redeploy da edge function

### Nota
Os endpoints existentes (Cadastrar, Excluir, Status, etc.) que já estão no playground continuam funcionando normalmente — esses usam a lógica interna do sistema. Os novos endpoints REST V3 fazem proxy direto para a API Solucionare, permitindo testar os endpoints raw.

