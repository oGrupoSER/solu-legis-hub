

# Plano: Implementar Variacoes, Termos de Bloqueio e Abrangencias para Publicacoes

## Problema Identificado

Analisando a documentacao (Secao 2), o objeto `NomePesquisa` da API SOAP possui 3 recursos importantes para maior assertividade que **NAO estao implementados**:

1. **Variacoes** (`variacoes: Variacao[]`) - Variantes ortograficas do nome buscado. Existe um metodo `gerarVariacoes` que gera automaticamente. A implementacao atual envia variacoes como string pipe-separated no `cadastrar`, mas NAO suporta geracao automatica nem o objeto completo.

2. **Termos de Bloqueio** (`termosBloqueio: TermoBloqueio[]`) - Termos que, quando encontrados junto ao nome de pesquisa, **impedem** a captura da publicacao. Cada termo tem:
   - `termo` (string): o texto bloqueador
   - `estaContidoNoNomePesquisa` (bool): se o bloqueio so se aplica quando encontrado junto/contido no texto do nome de pesquisa
   - **NAO implementado em nenhum lugar do sistema**

3. **Abrangencias** (`abrangencia: String[]`) - Siglas dos diarios de abrangencia do nome. A API SOAP tem `getAbrangencias` que retorna as opcoes disponiveis. **NAO implementado.**

4. **OAB** - Campo `oab` no `NomePesquisa`. **NAO implementado.**

## O Que Sera Feito

### 1. Evolucao do SOAP Client

O `SoapClient.buildEnvelope` atual so suporta parametros simples (string/int). Precisa suportar objetos complexos aninhados como `NomePesquisa` com arrays de `TermoBloqueio` e `Variacao`.

Sera adicionado um metodo `buildComplexParam` que gera XML para objetos aninhados com arrays.

### 2. Evolucao da Edge Function `manage-search-terms`

**Novas actions:**
- `gerar_variacoes`: Chama `gerarVariacoes(nomeRelacional, token, type, termo)` e retorna sugestoes automaticas
- `buscar_abrangencias`: Chama `getAbrangencias(nomeRelacional, token)` e retorna siglas de diarios disponiveis
- `visualizar_nome`: Chama `getNomePesquisa(nomeRelacional, token, codNome)` para obter o objeto completo com variacoes, bloqueios e abrangencias atuais

**Action `cadastrar_nome` atualizada:**
- Receber `termos_bloqueio: { termo: string, contido: boolean }[]` do frontend
- Receber `abrangencias: string[]` (siglas de diarios)
- Receber `oab: string` (opcional)
- Construir o objeto `NomePesquisa` completo no XML SOAP com todos os sub-arrays

**Action `editar_nome` atualizada:**
- Usar o fluxo correto da doc: primeiro `getNomePesquisa` para obter o objeto atual, depois manipular e devolver via `setNomePesquisa`
- Incluir variacoes, bloqueios e abrangencias na edicao

### 3. Evolucao da Edge Function `manage-publication-terms`

Esta funcao esta com implementacao SOAP incorreta (chama `cadastrar` sem parametros, depois `setNomePesquisa` separado). Sera corrigida para:
- Usar o mesmo padrao do `manage-search-terms` (cadastrar com objeto completo)
- Suportar variacoes, bloqueios e abrangencias

### 4. Evolucao do Frontend - Dialog de Cadastro/Edicao

O `SearchTermDialog.tsx` (usado em PublicationTerms) sera expandido com:

**Secao "Variacoes":**
- Campo de entrada + botao adicionar (ja existe no ManageTermDialog, sera portado)
- Botao "Gerar Automaticamente" que chama a action `gerar_variacoes` da API
- Suporte a tipo 1 (variacao de nome) e tipo 2 (variacao de OAB, formato "CODIGO|UF")
- Lista de variacoes com botao remover

**Secao "Termos de Bloqueio" (NOVA):**
- Campo de entrada para o termo bloqueador
- Checkbox "Somente quando contido no nome de pesquisa" (mapeia para `estaContidoNoNomePesquisa`)
- Botao adicionar
- Lista de termos de bloqueio com botao remover
- Tooltip explicativo: "Termos de bloqueio impedem a captura de publicacoes quando encontrados junto ao nome pesquisado"

**Secao "Abrangencias" (NOVA):**
- Multi-select com as siglas de diarios disponiveis (carregadas via `buscar_abrangencias`)
- Campo de busca para filtrar
- Botoes "Selecionar Todos" / "Limpar"

**Campo "OAB" (NOVO):**
- Input opcional que aparece quando term_type === 'name'

### 5. Armazenamento Local

Os dados adicionais (variacoes, bloqueios, abrangencias, OAB) serao armazenados no campo `raw_data` (JSONB) existente na tabela `search_terms` (atualmente nao existe esse campo, sera necessario adicionar via migration), ou alternativamente em um novo campo JSONB `metadata`.

**Estrutura do campo metadata/raw_data:**
```text
{
  "variacoes": ["J. Silva", "Joao S."],
  "termos_bloqueio": [
    { "termo": "TESTEMUNHA", "contido": true },
    { "termo": "PERITO", "contido": false }
  ],
  "abrangencias": ["DJE-SP", "DJE-MG", "DOU"],
  "oab": "123456|MG",
  "cod_nome": 12345
}
```

---

## Detalhes Tecnicos

### SOAP Client - Suporte a XML Complexo

O metodo `buildEnvelope` sera estendido para aceitar parametros do tipo objeto/array e gera-los como XML aninhado. Exemplo do XML que precisa ser gerado para cadastrar um nome completo:

```text
<nom:cadastrar>
  <nomeRelacional>ORBO</nomeRelacional>
  <token>xxx</token>
  <nomePesquisa>
    <codEscritorio>41</codEscritorio>
    <nome>Joao da Silva</nome>
    <oab>123456|MG</oab>
    <variacoes>
      <item><nome>J. Silva</nome></item>
      <item><nome>Joao S.</nome></item>
    </variacoes>
    <termosBloqueio>
      <item>
        <termo>TESTEMUNHA</termo>
        <estaContidoNoNomePesquisa>true</estaContidoNoNomePesquisa>
      </item>
    </termosBloqueio>
    <abrangencia>
      <string>DJE-SP</string>
      <string>DJE-MG</string>
    </abrangencia>
  </nomePesquisa>
</nom:cadastrar>
```

### Fluxo de Edicao (conforme doc secao 2.2.2)

A documentacao diz explicitamente: "A forma correta de consumir esse metodo e realizar uma consulta do nome com getNomePesquisa() e manipular o objeto do retorno. Depois de realizar as alteracoes necessarias, devolver o objeto para setNomePesquisa()."

O fluxo sera:
1. Frontend carrega o termo para edicao
2. Edge function chama `getNomePesquisa(codNome)` para obter estado atual
3. Frontend exibe variacoes, bloqueios e abrangencias atuais
4. Usuario faz alteracoes
5. Frontend envia objeto completo
6. Edge function chama `setNomePesquisa` com objeto completo

### Migration SQL

Adicionar coluna `metadata` (JSONB) na tabela `search_terms` para armazenar variacoes, bloqueios e abrangencias localmente.

### Arquivos a Modificar/Criar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Adicionar coluna `metadata` JSONB na tabela `search_terms` |
| `supabase/functions/_shared/soap-client.ts` | Adicionar suporte a XML complexo (objetos aninhados, arrays) |
| `supabase/functions/manage-search-terms/index.ts` | Novas actions: `gerar_variacoes`, `buscar_abrangencias`, `visualizar_nome`. Atualizar `cadastrar_nome` e `editar_nome` com objeto completo |
| `supabase/functions/manage-publication-terms/index.ts` | Corrigir chamadas SOAP para usar objeto NomePesquisa completo com variacoes, bloqueios e abrangencias |
| `src/components/terms/SearchTermDialog.tsx` | Expandir com secoes de variacoes (com geracao automatica), termos de bloqueio e abrangencias |
| `src/pages/PublicationTerms.tsx` | Ajustes menores para suportar os novos dados na tabela |

