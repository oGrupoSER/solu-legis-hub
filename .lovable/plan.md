

## Plano: Adicionar `BuscaTodosDocumentosPorProcesso` na sincronização

### Contexto
Atualmente os documentos são buscados apenas via `BuscaNovosDocumentosPorEscritorio` (novos não confirmados). O novo endpoint `BuscaTodosDocumentosPorProcesso?codProcesso=X` retorna **todos** os documentos de um processo, incluindo os já confirmados. A lógica de vínculo é:
- Se `codAndamento` está presente e existe um andamento na base → documento vinculado ao andamento
- Se `codAndamento` ausente ou não encontrado → documento "solto" do processo

### Alterações

**1. `supabase/functions/sync-process-updates/index.ts`**

Adicionar nova função `syncAllDocumentsByProcess` (seguindo o padrão de `syncAllMovementsByProcess`):
- Busca todos os processos com `cod_processo` não nulo
- Para cada processo, chama `GET /BuscaTodosDocumentosPorProcesso?codProcesso={cod}`
- Mapeia campos: `codDocumento` → `cod_documento`, `codProcesso` → `cod_processo`, `codAndamento` → `cod_andamento`, `codAgrupador` → `cod_agrupador`, `urlDocumento` → `documento_url`
- Faz lookup de `process_id` e `movement_id` (se `codAndamento` existir na tabela `process_movements`)
- Upsert em `process_documents` com `onConflict: 'cod_documento'`

Adicionar novo bloco condicional no fluxo principal:
```
if (syncType === 'full' || syncType === 'all-documents') {
  const allDocsSynced = await syncAllDocumentsByProcess(client, supabase, service);
  // + trigger linkOrphanDocuments + download
}
```

**2. `src/components/processes/SyncProgressDialog.tsx`**

Adicionar nova etapa após `"documents"`:
- `{ id: "all-documents", label: "Buscando todos documentos por processo" }`
- No array `updateStages`, adicionar `{ id: "all-documents", syncType: "all-documents" }`

**3. Sincronização em `/processes/movements`**

O `handleSync` em `ProcessMovements.tsx` já chama `syncType: "full"`, que executará automaticamente o novo `all-documents` junto com todas as outras etapas. Não precisa de alteração adicional nessa página.

