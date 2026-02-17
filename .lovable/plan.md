

# Plano: Adicionar Endpoints de Gerenciamento ao Playground de API e Postman

## Contexto

O Playground de API e a colecao Postman atualmente cobrem apenas endpoints de **consulta** (GET) e **confirmacao de lote** (POST simples). Os endpoints de **gerenciamento** (cadastrar, editar, excluir termos/processos) implementados nas edge functions nao estao disponiveis para teste nem documentados para clientes.

## O Que Sera Feito

### 1. Suporte a Body JSON no Playground

O playground atual so envia query params. Os endpoints de gerenciamento usam POST/PUT/DELETE com body JSON. Sera adicionado:
- Campo `bodyParams` na interface `EndpointDef` para definir campos do body
- Marcacao de campos como **obrigatorios** ou opcionais
- Editor de body JSON no painel de parametros
- Atualizacao do `handleTest` para enviar body quando presente

### 2. Novos Endpoints por Aba

**Aba Processos (sync-process-management):**
| Endpoint | Metodo | Campos Obrigatorios | Campos Opcionais |
|----------|--------|---------------------|------------------|
| Cadastrar Processo | POST | processNumber, serviceId, instance | uf, codTribunal, comarca, autor, reu, clientSystemId |
| Excluir Processo | POST | processNumber, serviceId | clientSystemId |
| Status do Processo | POST | processNumber, serviceId | - |
| Listar Processos Cadastrados | POST | serviceId | - |
| Reenviar Pendentes | POST | serviceId | - |

**Aba Distribuicoes (manage-distribution-terms):**
| Endpoint | Metodo | Campos Obrigatorios | Campos Opcionais |
|----------|--------|---------------------|------------------|
| Cadastrar Nome | POST | serviceId, nome | codTipoConsulta, listInstancias, abrangencias, qtdDiasCapturaRetroativa, listDocumentos, listOab, client_system_id |
| Editar Nome | POST | serviceId, termId | nome, codNome, codTipoConsulta, listInstancias, abrangencias, qtdDiasCapturaRetroativa, listDocumentos, listOab |
| Ativar Nome | POST | serviceId, codNome | - |
| Desativar Nome | POST | serviceId, codNome | - |
| Excluir Nome | POST | serviceId, codNome | client_system_id |
| Listar Nomes | POST | serviceId | - |

**Aba Publicacoes (manage-publication-terms / manage-search-terms):**
| Endpoint | Metodo | Campos Obrigatorios | Campos Opcionais |
|----------|--------|---------------------|------------------|
| Cadastrar Nome | POST | service_id, term, term_type | variacoes, termos_bloqueio, abrangencias, oab, client_system_id |
| Editar Nome | POST | service_id, term_id, term, term_type | variacoes, termos_bloqueio, abrangencias, oab |
| Excluir Nome | POST | service_id, term_id, term_type | client_system_id |
| Listar Termos | POST | service_id, term_type | - |

### 3. Organizacao Visual

Cada aba tera dois grupos de endpoints separados visualmente:
- **Consulta** (endpoints existentes - api-processes, api-distributions, api-publications)
- **Gerenciamento** (novos endpoints - sync-process-management, manage-distribution-terms, manage-publication-terms/manage-search-terms)

Um separador visual com label distinguira os dois grupos.

### 4. Atualizacao da Colecao Postman

Adicionar subpastas de gerenciamento dentro de cada pasta existente na colecao Postman, com body de exemplo e descricao de cada campo.

### 5. Autenticacao

Os endpoints de gerenciamento usam JWT (Supabase Auth) diferente dos endpoints de consulta (token customizado). O playground detectara o tipo de endpoint e:
- Para endpoints `api-*`: usara o token selecionado como Bearer
- Para endpoints de gerenciamento: usara o JWT do usuario logado (sessao Supabase) automaticamente, com indicacao visual no UI

---

## Detalhes Tecnicos

### Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/ApiTesting.tsx` | Adicionar interface bodyParams, novos endpoints de gerenciamento, suporte a body JSON, separacao visual consulta/gerenciamento, logica de auth JWT |
| `src/lib/postman-collection.ts` | Adicionar pastas de gerenciamento com body de exemplo |

### Interface Atualizada

```text
interface EndpointDef {
  id: string;
  label: string;
  method: string;
  description: string;
  path: string;
  category: 'query' | 'management';  // NOVO
  authType: 'token' | 'jwt';         // NOVO
  params: Array<{
    key: string;
    label: string;
    placeholder: string;
    type?: string;
    required?: boolean;               // NOVO
  }>;
  bodyParams?: Array<{               // NOVO - campos do body JSON
    key: string;
    label: string;
    placeholder: string;
    type?: string;
    required?: boolean;
  }>;
}
```

### Logica de Envio

Para endpoints com `bodyParams`, o `handleTest` construira um body JSON com os valores preenchidos. Campos vazios opcionais nao serao incluidos no body. Campos obrigatorios serao validados antes do envio.

### Exemplos de Codigo Atualizados

Os snippets curl/javascript/python incluirao o body JSON quando aplicavel:

```text
curl -X POST ".../sync-process-management" \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"register","serviceId":"...","processNumber":"..."}'
```

