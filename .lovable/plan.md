

## Plano: Dialog de Detalhamento de Distribuição

### Objetivo
Ao clicar em uma distribuição na tabela, abrir um dialog com todos os detalhes da distribuição, incluindo documentos vinculados (`documentos_iniciais` e `lista_documentos` do JSONB).

### Alterações

**1. Novo componente `src/components/distributions/DistributionDetailDialog.tsx`**
- Dialog com abas: **Dados Gerais** e **Documentos**
- **Dados Gerais**: número do processo, tribunal, comarca, órgão julgador, magistrado, tipo do processo, valor da causa, autor/réu (JSONB), advogados, data de distribuição, data de audiência, instância, UF, cidade
- **Documentos**: lista extraída de `documentos_iniciais` e `lista_documentos` (ambos JSONB). Cada documento mostra nome/tipo e link de download se disponível. Badge com contagem total de documentos no header da aba
- Estilo visual consistente com `ProcessDetails` (cards com ícones, badges)

**2. Alterar `src/pages/Distributions.tsx`**
- Adicionar state `selectedDistribution` para controlar o dialog
- Tornar cada `TableRow` clicável (`onClick` + `cursor-pointer`)
- Renderizar o `DistributionDetailDialog` passando a distribuição selecionada

### Estrutura esperada dos JSONB de documentos
Baseado no payload da Solucionare:
- `documentos_iniciais`: array de objetos com campos como `nomeArquivo`, `url`, `tipoDocumento`
- `lista_documentos`: array similar com documentos adicionais

O componente tratará ambos os arrays, fazendo merge e exibindo em lista unificada com fallback para JSON raw caso a estrutura varie.

### Arquivos
- `src/components/distributions/DistributionDetailDialog.tsx` (novo)
- `src/pages/Distributions.tsx` (alterado — adicionar click handler + dialog)

