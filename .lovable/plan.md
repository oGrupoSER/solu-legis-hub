

## Plano: Botão "Baixar Excel" na Resposta do Playground

### Objetivo
Adicionar um botão "Baixar Excel" ao lado do botão "Copiar" na área de resposta do Playground, para exportar dados JSON grandes como arquivo .xlsx.

### Como funciona
1. Ao clicar, analisa `response.data` para encontrar o array principal (pode estar na raiz ou dentro de uma propriedade como `data`, `results`, etc.)
2. Converte o array de objetos JSON em uma planilha Excel usando a biblioteca `xlsx` (SheetJS)
3. Faz download automático do arquivo `.xlsx`

### Alterações

**1. Instalar dependência `xlsx`**
- Adicionar o pacote `xlsx` (SheetJS) para conversão JSON → Excel no client-side

**2. `src/pages/ApiTesting.tsx`**
- Criar função `downloadExcel(data)` que:
  - Detecta o array principal no JSON (raiz se for array, ou primeira propriedade que seja array)
  - Achata objetos aninhados para colunas (ex: `cover.tribunal` → coluna `cover.tribunal`)
  - Gera workbook com `xlsx.utils.json_to_sheet`
  - Auto-ajusta largura das colunas
  - Dispara download como `.xlsx`
- Adicionar botão com ícone `Download` ao lado do botão `Copy` existente (linha 1175), visível apenas quando a resposta contém dados em array

### Detalhes técnicos
- Biblioteca: `xlsx` (SheetJS) — funciona 100% client-side, sem backend
- O botão aparece apenas quando há dados exportáveis (array com pelo menos 1 item)
- Nome do arquivo: `playground-export-{timestamp}.xlsx`

