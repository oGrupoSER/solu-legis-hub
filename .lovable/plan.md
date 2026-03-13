

## Plano: Corrigir mapeamento de status e ajustar indicadores

### Problema
1. O processo `5019592-45.2014.4.04.7100` mostra "Validando" mas deveria mostrar "Segredo" -- provavelmente o status não foi atualizado na última sincronização
2. Os indicadores (stats) devem mostrar 6 cards: 1 Total + 5 status dinâmicos (Cadastrado, Erro, Arquivado, Segredo, Validando)
3. O `STATUS_CONFIG` em `ProcessesStats.tsx` não tem o código 2 (Validando), então não exibe ícone correto

### Alterações

**1. `src/components/processes/ProcessesStats.tsx`**
- Adicionar status_code `2` ao `STATUS_CONFIG` com ícone `Clock` e cor amarela (Validando)
- Alterar grid de `lg:grid-cols-5` para `lg:grid-cols-6` para acomodar Total + 5 status

**2. `src/components/processes/ProcessesTable.tsx`**
- Adicionar status_code `6` ao `statusColors` com estilo para "Segredo" (ex: `bg-purple-500/20 text-purple-700`)

**3. Re-sincronizar o processo** -- O processo específico precisa ter seu status atualizado via "Verificar Status" na tabela, pois o `status_code` armazenado no banco está desatualizado (código 2 em vez de 6). Isso não é bug de código, é dado desatualizado.

