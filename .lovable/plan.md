

## Plano: Ocultar etapas redundantes do diálogo de sincronização

### O que muda

Remover as etapas **"Buscando novos andamentos"** (`movements`) e **"Buscando documentos"** (`documents`) do `SyncProgressDialog`, já que essas buscas por escritório sempre retornam 0 e são redundantes com as buscas por processo (`all-movements` e `all-documents`).

### Alterações

**`src/components/processes/SyncProgressDialog.tsx`**

1. Remover do `INITIAL_STAGES`:
   - `{ id: "movements", label: "Buscando novos andamentos" }`
   - `{ id: "documents", label: "Buscando documentos" }`

2. Remover do array `updateStages` no `runSync`:
   - `{ id: "movements", syncType: "movements" }`
   - `{ id: "documents", syncType: "documents" }`

As chamadas à edge function para esses syncTypes deixam de ser executadas. A busca completa por processo (`all-movements` e `all-documents`) já cobre todos os dados.

