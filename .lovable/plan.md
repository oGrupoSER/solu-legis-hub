
# Plano: Integrar Abrangencias no Cadastro de Termos de Distribuicao

## Problema Atual
O cadastro de nomes para monitoramento de distribuicoes falha porque o campo `listAbrangencias` esta sendo enviado vazio (`[]`), e a API retorna "E obrigatorio enviar uma abrangencia". Nao existe documentacao clara sobre os valores validos.

## Descoberta
A API de Processos (mesmo fornecedor Solucionare, mesmas credenciais ORBO) possui o endpoint `BuscaAbrangencia` que retorna a lista completa de sistemas/tribunais com seus codigos. Cada item contem:
- `codSistema` (numero): codigo unico do tribunal/sistema (ex: 1, 2, 130, 133...)
- `siglaSistema` (texto): sigla curta (ex: TRF1_PJE1, TJSP_ESAJ, TRT2_PJE...)
- `nomeSistema` (texto): nome completo (ex: "Tribunal de Justica de Sao Paulo - Esaj 1a instancia")

Sao aproximadamente 200+ sistemas cobrindo todos os tribunais do Brasil.

## Solucao

### 1. Nova action `listAbrangencias` na Edge Function `manage-distribution-terms`
Buscar as abrangencias do endpoint da API de Processos (mesmo fornecedor, mesmo nomeRelacional/token). Isso funciona porque o BuscaAbrangencia usa autenticacao via query params (NomeRelacional + Token), que sao os mesmos para todos os servicos do parceiro.

A URL sera construida a partir do servico de processos do mesmo parceiro, ou diretamente da URL base conhecida.

### 2. Atualizar o formulario de cadastro (`DistributionTerms.tsx`)
- Adicionar um seletor de abrangencias com busca/filtro
- Organizar os tribunais por grupo (TRFs, TJs, TRTs, Superiores) para facilitar a selecao
- Permitir selecao multipla (o campo `listAbrangencias` aceita array)
- Pre-carregar as abrangencias ao abrir o dialog de cadastro

### 3. Atualizar a action `registerName` na Edge Function
- Receber o parametro `abrangencias` (array de codSistema)
- Enviar `listAbrangencias` com os codigos selecionados ao inves de array vazio
- Tambem atualizar o retry de termos pendentes para usar abrangencias salvas

### 4. Testar o cadastro com abrangencias reais
Apos implementar, testar o cadastro de um nome com codSistema validos para confirmar que a API aceita.

---

## Detalhes Tecnicos

### Edge Function: `manage-distribution-terms/index.ts`

**Nova action `listAbrangencias`:**
- Busca o servico de processos do mesmo parceiro (`partner_id`)
- Chama `{processes_service_url}/BuscaAbrangencia?NomeRelacional={nome}&Token={token}`
- Retorna a lista organizada por grupos (Federais, Estaduais, Trabalhistas, Superiores)

**Action `registerName` atualizada:**
- Recebe `abrangencias: number[]` do frontend
- Envia `listAbrangencias: abrangencias` na chamada a API
- Salva as abrangencias selecionadas no campo `raw_data` do search_term para referencia futura

**Action `listNames` (retry) atualizada:**
- Ao re-tentar termos pendentes, recupera abrangencias salvas em `raw_data`

### Frontend: `src/pages/DistributionTerms.tsx`

**Dialog de cadastro expandido:**
- Novo campo "Abrangencias (Tribunais)" com componente de multi-selecao
- Agrupamento visual: Federais (TRF1-TRF5), Estaduais (TJs), Trabalhistas (TRTs), Superiores (STJ, STF, TST, TSE)
- Campo de busca para filtrar pelo nome ou sigla do tribunal
- Botoes rapidos: "Selecionar Todos", "Limpar"
- Indicador visual da quantidade selecionada

### Estrutura visual do seletor de abrangencias

```text
+------------------------------------------------------+
| Abrangencias (Tribunais)              [2 selecionados] |
|------------------------------------------------------|
| [Buscar tribunal...]                                  |
| [Selecionar Todos] [Limpar]                          |
|------------------------------------------------------|
| > Tribunais Superiores                                |
|   [ ] STJ - Superior Tribunal de Justica             |
|   [ ] STF - Supremo Tribunal Federal                 |
|   [x] TST - Tribunal Superior do Trabalho            |
| > Tribunais Regionais Federais                        |
|   [ ] TRF1_PJE1 - TRF 1a Regiao PJE 1a inst.       |
|   [x] TRF3_PJE1 - TRF 3a Regiao PJE 1a inst.       |
| > Tribunais de Justica Estaduais                      |
|   [ ] TJSP_ESAJ - TJ Sao Paulo Esaj 1a inst.        |
|   ...                                                |
| > Tribunais Regionais do Trabalho                     |
|   [ ] TRT2_PJE - TRT 2a Regiao PJE                  |
|   ...                                                |
+------------------------------------------------------+
```

### Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/manage-distribution-terms/index.ts` | Adicionar action `listAbrangencias`, atualizar `registerName` para enviar abrangencias, atualizar retry |
| `src/pages/DistributionTerms.tsx` | Expandir dialog de cadastro com seletor de abrangencias agrupado |
