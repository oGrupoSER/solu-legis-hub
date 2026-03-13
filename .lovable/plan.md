

## Plano: Paginação de 10 em 10

### Situação atual
- **Publications** (`PublicationsTable.tsx`): Já tem paginação, mas com `itemsPerPage = 20`. Basta alterar para 10.
- **Distributions** (`Distributions.tsx`): Sem paginação — renderiza todos os registros de uma vez.
- **Process Movements** (`ProcessMovements.tsx`): Sem paginação — ambas as tabs (Processos e Andamentos) renderizam tudo.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/components/publications/PublicationsTable.tsx` | Alterar `itemsPerPage = 20` para `itemsPerPage = 10` |
| `src/pages/Distributions.tsx` | Adicionar estado `currentPage`, paginar `filteredDistributions` com `.slice()` no front-end, e adicionar componente `Pagination` abaixo da tabela (mesmo padrão do PublicationsTable) |
| `src/pages/ProcessMovements.tsx` | Adicionar estado `currentPage` para cada tab (processos e andamentos), paginar com `.slice()`, adicionar componente `Pagination` abaixo de cada tabela. Resetar página ao mudar filtros ou tab |

### Padrão de paginação (reusado do PublicationsTable)
- `const itemsPerPage = 10`
- `const [currentPage, setCurrentPage] = useState(1)`
- Slice dos dados filtrados: `data.slice((currentPage - 1) * 10, currentPage * 10)`
- Texto "Mostrando X a Y de Z"
- Componente Pagination com Previous/Next e links de página
- Reset `currentPage(1)` em cada filtro

