

## Plano: Auto-Distribuição para Clientes Após Sincronização

### Objetivo
Após o sync-orchestrator baixar dados da Solucionare (publicações, distribuições, andamentos), automaticamente disparar webhooks para os sistemas clientes (Infojudiciais) notificando que há novos dados disponíveis.

### Como funciona hoje
1. `sync-orchestrator` chama `sync-processes`, `sync-distributions`, `sync-publications`
2. Dados são salvos no banco
3. **Nada acontece** — o Infojudiciais precisa fazer polling manual via `api-distributions`, `api-publications`, etc.

### O que será feito
Após cada sync bem-sucedido no orchestrator, invocar `api-webhook` com o evento correspondente, notificando todos os clientes que têm webhooks registrados para aquele tipo de dado.

### Alteração

**`supabase/functions/sync-orchestrator/index.ts`**

Após cada sync (linhas 149, 161, 201), quando houver registros sincronizados, chamar `api-webhook` com:
- `distribution.new` → quando `distributions_synced > 0`
- `publication.new` → quando `publications_synced > 0`  
- `process.updated` → quando `processes_synced > 0`

O payload do webhook incluirá um resumo (quantidade de novos registros, timestamp) para que o Infojudiciais saiba que deve chamar os endpoints `api-distributions`, `api-publications`, `api-processes` para buscar os dados completos.

```typescript
// Após todos os syncs, disparar webhooks
if (summary.distributions_synced > 0) {
  await invokeFunction('api-webhook', {
    event: 'distribution.new',
    data: { count: summary.distributions_synced, timestamp: new Date().toISOString() }
  });
}
// Similar para publications e processes
```

### Pré-requisito para funcionar
O Infojudiciais precisa ter um webhook registrado na tabela `client_webhooks` com a URL de callback e os eventos desejados (`['distributions', 'publications', 'processes']`). Isso já pode ser configurado pela interface de Clientes no Hub.

### Arquivo alterado
- `supabase/functions/sync-orchestrator/index.ts`

