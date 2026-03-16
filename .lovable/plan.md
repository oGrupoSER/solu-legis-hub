

## Plano: Reestruturar Distribuições no Playground com endpoints REST V3

### Endpoints desejados (do Postman)

| # | Label | Endpoint V3 | Action backend |
|---|-------|-------------|----------------|
| 1 | Dis - Autenticação | POST /AutenticaAPI | `rest_autenticar` (novo) |
| 2 | Dis - Cadastrar Escritório | POST /CadastrarEscritorio | `registerOffice` (existe) |
| 3 | Dis - Ativar Escritório | POST /AtivarEscritorio | `activateOffice` (existe) |
| 4 | Dis - Cadastrar Termo | POST /CadastrarNome | `registerName` (existe) |
| 5 | Dis - Desativar Termo | POST /DesativarNome | `deactivateName` (existe) |
| 6 | Dis - Buscar Distribuições | GET /BuscaNovasDistribuicoes | `rest_buscar_distribuicoes` (novo) |
| 7 | Dis - Buscar Nomes Cadastrados | GET /BuscaNomesCadastrados | `listNames` (existe) |

### Alterações

**1. Backend: `manage-distribution-terms/index.ts` — 2 ações novas**

- `rest_autenticar`: Apenas autentica e retorna o `tokenJWT` (para teste isolado)
- `rest_buscar_distribuicoes`: Chama `/BuscaNovasDistribuicoes?codEscritorio=X` e retorna resultado bruto

**2. Frontend: `src/pages/ApiTesting.tsx`**

Substituir os ~15 endpoints de gerenciamento de distribuições (linhas 166-320) por 7 endpoints que mapeiam 1:1 com o Postman:

- **Dis - Autenticação** → action `rest_autenticar`, body: `serviceId`
- **Dis - Cadastrar Escritório** → action `registerOffice`, body: `serviceId`, `codEscritorio` (41), `utilizaDocumentosIniciais` (1)
- **Dis - Ativar Escritório** → action `activateOffice`, body: `serviceId`, `codEscritorio` (41)
- **Dis - Cadastrar Termo** → action `registerName`, body: `serviceId`, `nome`, `codTipoConsulta` (1), `qtdDiasCapturaRetroativa` (90), `listInstancias` ([4]), `abrangencias` (lista fixa)
- **Dis - Desativar Termo** → action `deactivateName`, body: `serviceId`, `codNome`
- **Dis - Buscar Distribuições** → action `rest_buscar_distribuicoes`, body: `serviceId`, `codEscritorio` (41)
- **Dis - Buscar Nomes Cadastrados** → action `listNames`, body: `serviceId`

Atualizar `managementActionMap` removendo entradas antigas e adicionando as novas.

**3. `src/lib/postman-collection.ts`**

Atualizar pasta Distribuições/Gerenciamento com os 7 endpoints.

