

## Plano: Status "SEGREDO" + Cards clicáveis com paginação

### Problema 1: Processos com status "SEGREDO" não mapeados corretamente

A API retorna `"status": "SEGREDO"` mas o mapeamento `STATUS_STRING_TO_CODE` em `sync-process-management/index.ts` só possui `'SEGREDO DE JUSTICA'` e `'SEGREDO DE JUSTIÇA'`. O valor `"SEGREDO"` não encontra correspondência e cai no fallback `2` (Validando), o que faz com que o status real se perca.

**Correção em `supabase/functions/sync-process-management/index.ts`:**
- Adicionar `'SEGREDO': 6` ao mapeamento `STATUS_STRING_TO_CODE`
- Adicionar cor para status_code 6 em `ProcessesTable.tsx` (já existe: `6: "bg-red-500/20..."`)

### Problema 2: Cards de status não clicáveis + limite de 1000 linhas (plano aprovado anteriormente)

**`src/components/processes/ProcessesStats.tsx`:**
- Receber props `onStatusClick` e `activeStatus`
- Usar paginação com `.range()` para buscar todos os registros (loop em blocos de 1000)
- Tornar cada card clicável com destaque visual no card ativo
- Card "Total" limpa o filtro

**`src/pages/Processes.tsx`:**
- Passar `onStatusClick` e `activeStatus={filterStatus}` para `ProcessesStats`
- Corrigir `fetchStatusOptions` com mesma abordagem de paginação

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/sync-process-management/index.ts` | Adicionar `'SEGREDO': 6` ao mapeamento |
| `src/components/processes/ProcessesStats.tsx` | Cards clicáveis, paginação, props |
| `src/pages/Processes.tsx` | Passar callbacks, paginação no fetchStatusOptions |

### Após implementação

O usuário precisará re-sincronizar os processos para que o status "SEGREDO" seja corretamente mapeado como "Segredo de Justiça" (código 6).

