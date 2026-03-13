

## Plano: Expandir Capa do Processo com todos os campos e visualização JSON

### Objetivo
Mostrar todos os campos retornados pela API na aba Capa (incluindo campos do `raw_data` como `digital`, `linkConsultaProcesso`, `siglaSistema`, `nomeSistema`, `codSistema`, `codAgrupador`, `reu`, `autor`, `advogadoProcesso`, `outrosEnvolvidos`) e adicionar toggle para ver o JSON bruto.

### Alterações em `src/components/processes/ProcessCoverTab.tsx`

1. **Expandir interface Cover** para incluir todos os campos da tabela `process_covers` (`digital`, `cod_sistema`, `sigla_sistema`, `nome_sistema`, `link_consulta_processo`, `cod_agrupador`, `cod_processo`, `raw_data`)

2. **Adicionar seções faltantes na visualização formatada:**
   - **Sistema**: `sigla_sistema`, `nome_sistema`, `cod_sistema`, `digital` (badge Sim/Não)
   - **Identificação**: `cod_processo`, `cod_agrupador`
   - **Link**: `link_consulta_processo` como link clicável (abre em nova aba)
   - **Partes** (do `raw_data`): listar `autor`, `reu`, `advogadoProcesso`, `outrosEnvolvidos` em sub-seções com nome, CPF/CNPJ, OAB quando aplicável

3. **Adicionar botão toggle "Ver JSON"** no header do Card:
   - Estado `showJson` (boolean)
   - Quando ativo, renderiza `<pre>` com `JSON.stringify(cover.raw_data, null, 2)` em bloco com scroll
   - Quando inativo, mostra a visualização formatada atual (expandida)

4. **Ajustar layout**: manter grid 2 colunas para campos estruturados; partes e JSON ocupam largura total (`col-span-2`)

