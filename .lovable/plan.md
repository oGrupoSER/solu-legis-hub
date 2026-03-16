

## Plano: Reestruturar Publicações no Playground com endpoints REST V2 individuais

### Problema

Os endpoints atuais de Publicações no Playground misturam SOAP e abstrações genéricas (`manage-publication-terms`). O usuário quer que cada chamada real da API REST V2 da Solucionare (conforme a coleção Postman) seja um endpoint testável individualmente. Também quer remover a aba "Integração".

### O que precisa mudar

**1. Backend: Adicionar ações REST V2 ao `manage-search-terms/index.ts`**

Atualmente só tem ações SOAP. Precisamos adicionar 11 ações REST V2 que fazem chamadas individuais à `WebApiPublicacoesV2`:

| Ação | Endpoint REST V2 | Método |
|------|-------------------|--------|
| `rest_autenticar` | `/Autenticacao/AutenticaAPI` | POST |
| `rest_cadastrar_nome` | `/Nome/nome_cadastrar` | POST |
| `rest_excluir_nome` | `/Nome/nome_excluir` | POST |
| `rest_consultar_nomes` | `/Nome/nome_buscarPorCodEscritorio` | GET |
| `rest_cadastrar_oab` | `/Oab/oab_Cadastrar` | POST |
| `rest_consultar_oab` | `/Oab/oab_buscar` | GET |
| `rest_cadastrar_variacao` | `/Variacao/variacao_cadastrar` | POST |
| `rest_cadastrar_termo_validacao` | `/TermoValidacao/termoValidacao_cadastrar` | POST |
| `rest_cadastrar_abrangencia` | `/Abrangencia/abrangencia_cadastrar` | POST |
| `rest_buscar_catalogo` | `/Abrangencia/abrangencia_buscarCatalogo` | GET |
| `rest_buscar_publicacoes` | `/Publicacao/publicacao_buscar` | GET |

Cada ação:
- Autentica automaticamente (chama `AutenticaAPI` primeiro para obter `tokenJWT`), exceto a própria ação `rest_autenticar`
- Faz a chamada individual ao endpoint REST V2
- Retorna a resposta crua da Solucionare
- Loga em `api_call_logs`

Reutiliza o padrão de `apiCall` já existente em `register-publication-term`.

**2. Frontend: Reescrever `publicationEndpoints` em `ApiTesting.tsx`**

Manter os 3 endpoints de **Consulta** (Listar Publicações, Detalhe, Confirmar Lote) que já existem.

Substituir todos os endpoints de **Gerenciamento** por 11 novos que mapeiam 1:1 com os endpoints REST V2:

- Pub - Autenticação → action `rest_autenticar` (body: `service_id`)
- Pub - Cadastrar Nome → action `rest_cadastrar_nome` (body: `service_id`, `data.nome`, `data.codEscritorio`)
- Pub - Excluir Nome → action `rest_excluir_nome` (body: `service_id`, `data.codNome`)
- Pub - Consultar Nomes → action `rest_consultar_nomes` (body: `service_id`, `data.codEscritorio`, `data.codUltimoNome`)
- Pub - Cadastrar OAB → action `rest_cadastrar_oab` (body: `service_id`, `data.codNome`, `data.uf`, `data.numero`, `data.letra`)
- Pub - Consultar OAB → action `rest_consultar_oab` (body: `service_id`, `data.codNome`, `data.codUltimoOab`)
- Pub - Cadastrar Variação → action `rest_cadastrar_variacao` (body: `service_id`, `data.codNome`, `data.listVariacoes`, `data.variacaoTipoNumProcesso`)
- Pub - Cadastrar TermoValidação → action `rest_cadastrar_termo_validacao` (body: `service_id`, `data.listTermosValidacaoNome`, `data.listTermosValidacaoVariacao`)
- Pub - Cadastrar Abrangência → action `rest_cadastrar_abrangencia` (body: `service_id`, `data.codNome`, `data.listCodDiarios`)
- Pub - Buscar Catálogo → action `rest_buscar_catalogo` (body: `service_id`)
- Pub - Buscar Publicações → action `rest_buscar_publicacoes` (body: `service_id`, `data.codEscritorio`)

Os placeholders e descrições refletem exatamente os exemplos do Postman (ex: `codEscritorio: 41`, `letra: "s"`).

**3. Remover aba "Integração"**

- Remover `integrationEndpoints` array
- Remover entradas `int-*` do `managementActionMap`
- Remover `"integration"` de `allTabs`
- Remover referências no `getEndpointsForTab`, `TabsTrigger`, imports (`Link`)

**4. Atualizar `postman-collection.ts`**

- Substituir endpoints SOAP de publicações pelos 11 REST V2
- Remover pasta "Integração Sistema-a-Sistema"

### Escopo
- `manage-search-terms/index.ts`: ~120 linhas novas (11 ações REST V2 + helper `restApiCall`)
- `ApiTesting.tsx`: reescrever `publicationEndpoints` (~150 linhas) + remover integração (~100 linhas removidas)
- `postman-collection.ts`: atualizar pasta Publicações + remover Integração

