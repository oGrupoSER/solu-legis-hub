

## Plano: Sincronização Incremental e Resiliente

### Problemas Identificados

1. **Etapas paginadas re-processam tudo**: `all-movements`, `all-documents` e `covers` iteram por TODOS os processos a cada sync, mesmo os já processados hoje.

2. **Busca redundante de histórico completo**: Usando `BuscaTodosAndamentosPorProcesso` e `BuscaTodosDocumentosPorProcesso` (histórico completo), quando o ideal é buscar apenas novos via `BuscaNovosAndamentosPorEscritorio` e `BuscaNovosDocumentosPorEscritorio` + confirmar recebimento.

3. **Status dos processos com timeout**: O `sync` (Macro Processo 1) chama `BuscaStatusProcesso` individualmente para cada um dos 309+ processos, gerando timeout. Deveria usar apenas `BuscaProcessos` (bulk).

### Correções

**1. `sync-process-management/index.ts` — Corrigir sync de status**

Remover o loop individual `BuscaStatusProcesso` (linhas 461-492) que itera processo a processo. Manter apenas o `BuscaProcessos` bulk (linha 495) que já retorna status de todos de uma vez.

**2. `sync-process-updates/index.ts` — Trocar para endpoints incrementais**

Substituir as etapas `all-movements` e `all-documents` (que iteram processo a processo com `BuscaTodos*`) pelos endpoints bulk incrementais:

- **Andamentos**: Usar `BuscaNovosAndamentosPorEscritorio` em loop (já implementado como `syncMovements`) — retorna até 500 não-confirmados por chamada. Chamar em loop até retornar vazio, confirmando cada lote.
- **Documentos**: Usar `BuscaNovosDocumentosPorEscritorio` em loop (já implementado como `syncDocuments`) — mesma lógica.
- **Habilitar confirmação**: Sempre confirmar recebimento após salvar, independente do flag `confirm_receipt`, para que a próxima sync não re-baixe os mesmos dados.

**3. `sync-process-updates/index.ts` — Covers: pular já sincronizados hoje**

Na função `syncCovers`, filtrar processos que já tenham `last_cover_sync_at` hoje:
```
.or('last_cover_sync_at.is.null,last_cover_sync_at.lt.{hoje}')
```

**4. `SyncProgressDialog.tsx` — Atualizar etapas**

- Renomear etapas para refletir a lógica incremental:
  - "Buscando novos andamentos" (em vez de "todos andamentos por processo")
  - "Buscando novos documentos" (em vez de "todos documentos por processo")
- Andamentos e documentos passam a ser **não-paginados** (uma única invocação com loop interno na edge function)
- Covers continua paginado mas será mais rápido (pula processos já atualizados hoje)

### Resultado Esperado

```text
Etapa                    Endpoint                              Chamadas
─────────────────────── ───────────────────────────────────── ────────
✅ Status (bulk)         BuscaProcessos                         1
✅ Agrupadores           BuscaAgrupadoresPorEscritorio          1
✅ Novos andamentos      BuscaNovosAndamentosPorEscritorio      1-5 (loop)
✅ Novos documentos      BuscaNovosDocumentosPorEscritorio      1-5 (loop)
✅ Capas (incrementais)  BuscaDadosCapaProcessoPorProcesso      ~0-30 (só novos)
✅ Dependências          BuscaDependenciasPorEscritorio          1
```

### Arquivos alterados
- `supabase/functions/sync-process-management/index.ts` — remover loop individual de status
- `supabase/functions/sync-process-updates/index.ts` — trocar all-movements/all-documents por endpoints incrementais com confirmação; filtrar covers por data
- `src/components/processes/SyncProgressDialog.tsx` — atualizar labels e remover paginação de andamentos/documentos

