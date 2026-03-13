

## Plano: Cards clicáveis + garantir todos os status nos indicadores

### Problemas identificados

1. **Status ausentes nos indicadores**: A query `select("status_code, status_description")` da tabela `processes` está sujeita ao limite padrão de 1000 linhas do Supabase. Se há mais de 1000 processos, alguns status (como "Segredo de Justiça") podem não aparecer nos cards porque suas linhas ficam fora do range retornado.

2. **Cards não são clicáveis**: Atualmente os cards de status são apenas informativos. O usuário quer clicar num card para filtrar a tabela pelos processos daquele status.

### Alterações

**`src/components/processes/ProcessesStats.tsx`**
- Receber callback `onStatusClick(statusDescription: string)` via props
- Receber prop `activeStatus` para destacar visualmente o card selecionado
- Tornar cada card clicável com `cursor-pointer` e estilo de seleção (ring/border)
- Card "Total" clica para limpar o filtro (`onStatusClick("all")`)
- Corrigir a query para não perder status: usar paginação para buscar todos os registros, ou uma abordagem mais eficiente com `select("status_code, status_description")` iterando com range até cobrir todos os registros

**`src/pages/Processes.tsx`**
- Passar `onStatusClick` e `activeStatus={filterStatus}` para `ProcessesStats`
- No handler, setar `setFilterStatus(status)` para que a tabela filtre automaticamente
- Corrigir também a query de `fetchStatusOptions` para cobrir mais de 1000 linhas (mesma abordagem)

### Abordagem para o limite de 1000 linhas

Usar paginação incremental na query de stats: buscar em blocos de 1000 usando `.range()` até que não haja mais dados. Isso garante que todos os `status_description` distintos apareçam nos indicadores independente da quantidade de processos.

### Arquivos afetados
| Arquivo | Mudança |
|---------|---------|
| `src/components/processes/ProcessesStats.tsx` | Cards clicáveis, props onStatusClick/activeStatus, paginação na query |
| `src/pages/Processes.tsx` | Passar callbacks, corrigir query de status options com paginação |

