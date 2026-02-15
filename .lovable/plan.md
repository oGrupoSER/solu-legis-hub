
# Cadastrar Servico de Distribuicoes e Corrigir Edge Functions

## Problema Atual

Nao existe um `partner_service` do tipo `distributions` cadastrado no parceiro Solucionare. Alem disso, as Edge Functions `manage-distribution-terms` e `sync-distributions` possuem chamadas incorretas aos endpoints da API V3 de Distribuicoes.

## Diferencas Encontradas (Codigo Atual vs Documentacao)

### manage-distribution-terms

| Acao | Codigo Atual (ERRADO) | Documentacao (CORRETO) |
|------|----------------------|----------------------|
| listNames | GET `/BuscaNomesCadastrados` sem params | GET `/BuscaNomesCadastrados?codEscritorio={codEscritorio}` |
| registerName | POST `/CadastrarNome` sem codEscritorio/codTipoConsulta | POST `/CadastrarNome` com `codEscritorio`, `codTipoConsulta`, `listInstancias`, `listAbrangencias` (obrigatorios) |
| activateName | PUT `/AtivarNome?codNome=X` | PATCH `/AtivarNome` com body `{codNome: X}` |
| deactivateName | PUT `/DesativarNome?codNome=X` | PATCH `/DesativarNome` com body `{codNome: X}` |
| deleteName | DELETE `/ExcluirNome?codNome=X` | DELETE `/ExcluirNome` com body `{codNome: X}` |

### sync-distributions

| Acao | Codigo Atual (ERRADO) | Documentacao (CORRETO) |
|------|----------------------|----------------------|
| BuscaNovas | GET `/BuscaNovasDistribuicoes?termo=X` | GET `/BuscaNovasDistribuicoes?codEscritorio={codEscritorio}` |
| ConfirmaRecebimento | POST com `{ids: [...]}` | POST com `{distribuicoes: [{codEscritorio, codProcesso}]}` |

## Plano de Implementacao

### Passo 1: Cadastrar partner_service de distribuicoes

Inserir via SQL migration um novo registro em `partner_services`:
- `partner_id`: `0eb613d6-819d-4d2c-9a7e-4e5b6592c22e` (Solucionare)
- `service_name`: "API V3 Distribuicoes"
- `service_type`: "distributions"
- `service_url`: `http://online.solucionarelj.com.br:9090/WebApiDistribuicoesV3/api/distribuicoes`
- `nome_relacional`: "ORBO"
- `token`: (mesmo token dos outros servicos do parceiro)

O token sera copiado dos servicos existentes do mesmo parceiro.

### Passo 2: Corrigir manage-distribution-terms Edge Function

Correcoes no `supabase/functions/manage-distribution-terms/index.ts`:

- **listNames**: Adicionar `codEscritorio` como query param obrigatorio (buscar do partner via `getOfficeCode`)
- **registerName**: Enviar body completo com `codEscritorio`, `codTipoConsulta: 1`, `listInstancias: [instancia]`, `listAbrangencias: [abrangencia]`
- **activateName**: Mudar de PUT com query param para PATCH com body `{codNome}`
- **deactivateName**: Mudar de PUT com query param para PATCH com body `{codNome}`
- **deleteName**: Mudar de DELETE com query param para DELETE com body `{codNome}`

### Passo 3: Corrigir sync-distributions Edge Function

Correcoes no `supabase/functions/sync-distributions/index.ts`:

- **BuscaNovasDistribuicoes**: Usar `?codEscritorio={officeCode}` em vez de `?termo=`; buscar `office_code` do parceiro
- **ConfirmaRecebimentoDistribuicoes**: Corrigir formato do body para `{distribuicoes: [{codEscritorio, codProcesso}]}`
- Remover loop por termo individual: a API retorna todas distribuicoes do escritorio de uma vez

### Passo 4: Deploy das Edge Functions

Fazer deploy das duas funcoes corrigidas:
- `manage-distribution-terms`
- `sync-distributions`

## Detalhes Tecnicos

### Formato correto CadastrarNome (body):
```text
{
  "codEscritorio": 15,
  "nome": "Joao da Silva",
  "codTipoConsulta": 1,
  "listInstancias": [1],
  "listAbrangencias": ["NACIONAL"]
}
```

### Formato correto BuscaNovasDistribuicoes (resposta):
```text
[{
  "codProcesso": 1,
  "codEscritorio": 15,
  "numeroProcesso": "0001234-56.2025.8.26.0100",
  "instancia": 1,
  "tribunal": "TJSP",
  "comarca": "Sao Paulo",
  "autor": [{nome, cpf, cnpj}],
  "reu": [{nome, cpf, cnpj}],
  "dataDistribuicao": "2025-01-15",
  ...
}]
```

### URL base do servico:
`http://online.solucionarelj.com.br:9090/WebApiDistribuicoesV3/api/distribuicoes`

Todos os endpoints sao relativos a essa URL base (ex: `/AutenticaAPI`, `/CadastrarNome`, `/BuscaNomesCadastrados`, `/BuscaNovasDistribuicoes`).
