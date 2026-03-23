## ✅ Implementado: Sincronização Incremental e Resiliente

### Alterações realizadas

**1. `supabase/functions/sync-process-management/index.ts`**
- Removido loop individual `BuscaStatusProcesso` (309+ chamadas HTTP)
- Mantido apenas `BuscaProcessos` bulk (1 chamada)

**2. `supabase/functions/sync-process-updates/index.ts`**
- Andamentos: usa `BuscaNovosAndamentosPorEscritorio` (bulk incremental) + confirmação automática
- Documentos: usa `BuscaNovosDocumentosPorEscritorio` (bulk incremental) + confirmação automática
- Capas: filtra por `last_cover_sync_at < hoje` (pula processos já atualizados)
- Confirmação sempre habilitada (independente de `confirm_receipt` flag) para andamentos e documentos

**3. `src/components/processes/SyncProgressDialog.tsx`**
- Labels atualizados: "Buscando novos andamentos/documentos"
- Andamentos e documentos não-paginados (loop interno na edge function)
- Capas continua paginado mas mostra "Todos já atualizados hoje" quando não há pendentes
