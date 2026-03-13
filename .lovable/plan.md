

## Plano: Adicionar coluna "Código Processo" em /processes e /processes/movements

### Alterações

**1. `src/components/processes/ProcessesTable.tsx` (tabela em /processes)**
- Adicionar `cod_processo` à interface `Process` (já existe no banco mas não no tipo)
- Adicionar `<TableHead>Código</TableHead>` após "Número do Processo" (linha 145)
- Adicionar `<TableCell>{process.raw_data?.codProcesso || process.cod_processo || "-"}</TableCell>` correspondente
- Atualizar `colSpan` de 7 para 8
- Adicionar `cod_processo` ao filtro de busca: `cod_processo::text.ilike.%${searchQuery}%`

**2. `src/pages/ProcessMovements.tsx` (tabela em /processes/movements)**
- Adicionar `<TableHead>Código</TableHead>` após "Número do Processo" (linha 528)
- Adicionar `<TableCell>{proc.cod_processo || "-"}</TableCell>` correspondente
- Atualizar `colSpan` de 7 para 8
- Incluir `cod_processo` no filtro de busca da página

