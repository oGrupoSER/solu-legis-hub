

## Plano: Indicadores dinâmicos baseados em status do parceiro

### Problema
Os cards de status estão hardcoded (Pendente, Cadastrado, Erro, Arquivado). O correto é: 1 card "Total" fixo + cards dinâmicos gerados a partir dos `status_description` distintos existentes na base.

### Alteração

**`src/components/processes/ProcessesStats.tsx`**

- Buscar `status_code, status_description` da tabela `processes`
- Calcular total
- Agrupar por `status_description` com contagem (usando um `Map` ou `reduce`)
- Renderizar 1 card fixo "Total" + N cards dinâmicos, um por cada `status_description` distinto encontrado
- Ícone e cor dinâmicos: mapear `status_code` conhecidos (1=Clock/warning, 4=CheckCircle/success, 5=Archive/muted, 7=AlertCircle/destructive) com fallback genérico para status desconhecidos
- Grid responsivo: `md:grid-cols-{N+1}` com máximo razoável, ou usar `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` para flexibilidade
- Também atualizar o filtro de status em `Processes.tsx` para ser dinâmico (buscar distinct status da base) em vez de hardcoded

### Arquivos afetados
| Arquivo | Mudança |
|---------|---------|
| `src/components/processes/ProcessesStats.tsx` | Cards dinâmicos baseados em distinct status_description |
| `src/pages/Processes.tsx` | Filtro de status dinâmico |

