

## Plano: Logs de API no cadastro + Migrar Sincronizar para REST V2

### Duas alterações solicitadas:

**1. Logs no cadastro de termos (`register-publication-term`)**
- A Edge Function já salva logs em `api_call_logs` para cada chamada de API (linhas 53-68). Está implementado.
- Falta criar um `sync_log` para agrupar as chamadas. Vou adicionar a criação de um registro em `sync_logs` no início do fluxo (tipo `register-term`, status `in_progress`) e atualizar para `success`/`error` no final. Assim cada chamada de API fica vinculada ao `sync_log_id`.

**2. Botão "Sincronizar" em `/publications/terms` → REST V2**
- Atualmente chama `sync-search-terms` que usa SOAP (`getNomesPesquisa`).
- Migrar para consumir a API REST V2:
  1. `POST /Autenticacao/AutenticaAPI` → tokenJWT
  2. `GET /Publicacao/publicacao_buscar?codEscritorio=41` → buscar publicações
- Também registrar logs em `api_call_logs` e `sync_logs`.

### Arquivos a modificar/criar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/register-publication-term/index.ts` | Adicionar criação de `sync_log` + vincular `sync_log_id` nas chamadas de `api_call_logs` |
| `supabase/functions/sync-search-terms/index.ts` | **Reescrever** - Migrar de SOAP para REST V2: autenticar → `publicacao_buscar?codEscritorio=41`. Registrar logs em `api_call_logs` e `sync_logs` |
| `src/pages/PublicationTerms.tsx` | Ajustar `handleSync` se necessário (a interface da Edge Function pode mudar) |

### Detalhes da Edge Function `sync-search-terms` (nova versão)

```text
Fluxo:
1. Criar sync_log (type: 'sync-publication-terms', status: 'in_progress')
2. Buscar service config (nomeRelacional, token)
3. POST /Autenticacao/AutenticaAPI → tokenJWT (logar em api_call_logs)
4. GET /Publicacao/publicacao_buscar?codEscritorio=41 → publicações (logar em api_call_logs)
5. Processar resultado e salvar/atualizar publicações localmente
6. Atualizar sync_log → success/error com records_synced
```

### Detalhes do `register-publication-term` (ajuste)

- No início: inserir em `sync_logs` com `sync_type: 'register-publication-term'`
- Passar `sync_log_id` para cada chamada `apiCall` → salvar no `api_call_logs.sync_log_id`
- No final: atualizar `sync_logs` com status final

