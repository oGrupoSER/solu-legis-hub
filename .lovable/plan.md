

## Plano: Ocultar colunas Parceiro/Serviço

### Alterações

**1. `src/components/publications/PublicationsTable.tsx`**
- Remover `<TableHead>Parceiro/Serviço</TableHead>` (linha 290)
- Remover `<TableCell>` com partner name e service name (linhas 328-333)
- Remover filtro de parceiro do header (Select de Parceiro, linhas 226-234)
- Remover estados e queries de parceiro (`filterPartner`, `partnerOptions`, fetch de partners)

**2. `src/pages/Distributions.tsx`**
- Remover `<TableHead>Parceiro</TableHead>` e `<TableHead>Serviço</TableHead>` (linhas 258-259)
- Remover `<TableCell>` com partner name e service name (linhas 275-276)
- Remover filtro de parceiro do header (Select de Parceiro, linhas 195-203)
- Remover estado `filterPartner` e query `partners-filter`

