

## Plano: Adicionar todos os endpoints da Solucionare ao Playground

### Situação atual

O Playground expõe **~20 endpoints** divididos em Processos, Distribuições e Publicações (consulta + gerenciamento). Porém, existem **~30 ações adicionais** nas edge functions que consomem a Solucionare mas não estão acessíveis pelo Playground.

### Endpoints faltantes por categoria

**1. Processos (`sync-process-management`) — 2 faltantes:**
- `sync` — Sincroniza status de todos os processos + busca novos via BuscaProcessos
- `list` (BuscaProcessosCadastrados) — já existe no playground

**2. Distribuições (`manage-distribution-terms`) — 8 faltantes:**
- `editNameScope` — Editar instâncias/abrangências de um nome
- `registerOffice` — Cadastrar escritório
- `activateOffice` / `deactivateOffice` — Ativar/desativar escritório
- `listScopes` — Listar escritórios cadastrados (BuscaEscritoriosCadastrados)
- `listSystems` — Listar status dos sistemas (BuscaStatusSistemas)
- `listAllNames` — Listar todos os nomes (BuscaNomesCadastrados)
- `listAbrangencias` — Listar abrangências disponíveis (SOAP/REST)

**3. Publicações SOAP (`manage-search-terms`) — 15 faltantes:**
- `cadastrar_nome` — Cadastrar nome de pesquisa (SOAP)
- `editar_nome` — Editar nome (variações, bloqueios, abrangências)
- `ativar_nome` / `desativar_nome` — Ativar/desativar nome
- `excluir_nome` — Excluir nome (SOAP)
- `excluir_nome_rest` — Excluir nome (REST V2)
- `cadastrar_escritorio` — Cadastrar escritório
- `ativar_escritorio` / `desativar_escritorio` — Ativar/desativar escritório
- `listar_nomes` — Listar nomes cadastrados (SOAP)
- `listar_escritorios` — Listar escritórios (SOAP)
- `sync_all` — Sincronizar todos os nomes e escritórios
- `gerar_variacoes` — Gerar variações automáticas de um nome
- `buscar_abrangencias` — Buscar diários disponíveis
- `visualizar_nome` — Visualizar configuração completa de um nome

**4. API Management (Token-based) (`api-management`) — 9 faltantes (aba nova):**
- `register-pub-term` / `delete-pub-term`
- `register-dist-term` / `delete-dist-term`
- `register-process` / `delete-process`
- `list-services` / `list-my-terms` / `list-my-processes`

### Alterações

**1. `src/pages/ApiTesting.tsx`**

Adicionar todos os endpoints faltantes nas respectivas arrays:

- **`processEndpoints`**: Adicionar `sync` (Sincronizar Processos)
- **`distributionEndpoints`**: Adicionar 8 novos endpoints (editNameScope, registerOffice, activateOffice, deactivateOffice, listScopes, listSystems, listAllNames, listAbrangencias)
- **`publicationEndpoints`**: Adicionar 15 novos endpoints do `manage-search-terms` (cadastrar_nome, editar_nome, ativar_nome, desativar_nome, excluir_nome, excluir_nome_rest, cadastrar_escritorio, ativar_escritorio, desativar_escritorio, listar_nomes, listar_escritorios, sync_all, gerar_variacoes, buscar_abrangencias, visualizar_nome)
- **Nova aba "Integração"**: Adicionar aba com os 9 endpoints do `api-management` (Token-based, não JWT)
- **`managementActionMap`**: Adicionar mapeamento de todos os novos IDs para suas respectivas actions

Cada endpoint segue o formato existente: `{ id, label, method, path, category, authType, description, params, bodyParams }` com os campos corretos.

**2. `src/lib/postman-collection.ts`**

Adicionar os mesmos endpoints nas respectivas pastas Postman:
- Pasta Processos/Gerenciamento: +1 (sync)
- Pasta Distribuições/Gerenciamento: +8
- Pasta Publicações/Gerenciamento: +15
- Nova pasta "Integração Sistema-a-Sistema": +9 endpoints api-management

### Detalhes de implementação

- Todos os endpoints de `manage-search-terms` usam `path: "manage-search-terms"` e `authType: "jwt"`, com `bodyParams` contendo os campos: `service_id` (obrigatório), `action` (mapeado via managementActionMap), e campos específicos de cada ação
- Os endpoints de `api-management` usam `path: "api-management"` e `authType: "token"`, com `bodyParams` contendo `action` e `data` (objeto aninhado)
- A aba "Integração" usa icone `Link` e badge "Token" (não JWT)
- Para a aba Integração, o `buildBody` precisa de ajuste para aninhar os parâmetros dentro de `{ action, data: {...} }` em vez de colocar tudo flat

### Escopo estimado
- ~200 linhas adicionais em `ApiTesting.tsx` (definições de endpoints)
- ~100 linhas adicionais em `postman-collection.ts`
- Ajuste no `buildBody` para suportar o formato aninhado do `api-management`

