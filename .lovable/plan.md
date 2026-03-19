

## Plano: Tela de Agendamento de Sincronizações com pg_cron

### Objetivo
Criar uma tela dedicada para configurar e consultar agendamentos automáticos de sincronização (publicações, distribuições, processos) usando pg_cron, eliminando a necessidade de clicar manualmente em "Sincronizar" nas 3 telas.

### Alterações

**1. Migration SQL** — Habilitar extensões e criar tabelas:
- Habilitar `pg_cron` e `pg_net`
- Criar tabela `scheduled_sync_jobs`: id, name, services (array), cron_expression, is_active, last_run_at, next_run_at, created_at, updated_at
- Criar tabela `scheduled_sync_logs`: id, job_id, status (success/error), started_at, completed_at, result (jsonb), error_message
- RLS: authenticated pode ler/inserir/atualizar/deletar jobs; authenticated pode ler logs

**2. SQL Insert (não migration)** — Registrar os cron jobs no pg_cron via `cron.schedule()` usando `net.http_post` para chamar `sync-orchestrator`. Os horários serão convertidos para UTC (BRT = UTC-3).

**3. Edge Function `manage-scheduled-sync`** — Gerenciar cron jobs:
- `list`: listar jobs ativos
- `create`: criar novo agendamento (insere na tabela + cria entrada pg_cron)
- `update`: atualizar horários/serviços
- `delete`: remover agendamento
- `toggle`: ativar/desativar
- `logs`: consultar histórico de execuções
- Internamente executa SQL para `cron.schedule()` / `cron.unschedule()`

**4. `supabase/config.toml`** — Adicionar `manage-scheduled-sync` com `verify_jwt = true`

**5. Nova página `src/pages/ScheduledSync.tsx`**:
- Breadcrumb: Dashboard > Agendamentos
- Cards de resumo: total de jobs, ativos, última execução, próxima execução
- Tabela principal com colunas: Nome, Serviços (badges), Expressão Cron, Horários legíveis, Status (ativo/inativo), Última execução, Ações
- Dialog para criar/editar agendamento:
  - Nome do agendamento
  - Checkboxes para serviços: Publicações, Distribuições, Processos
  - Seleção de horários via chips clicáveis (00h-23h) ou campo cron expression manual
  - Toggle ativo/inativo
- Tabela de logs de execução: data/hora, status, duração, registros sincronizados, erros
- Botão "Executar Agora" para rodar manualmente

**6. `src/App.tsx`** — Adicionar rota `/scheduled-sync`

**7. `src/components/layout/AppSidebar.tsx`** — Adicionar item "Agendamentos" no grupo "Integração" com ícone `Clock`

### Fluxo
```text
Usuário configura horários na UI
  → Edge function cria/atualiza pg_cron job
    → pg_cron dispara nos horários configurados
      → pg_net faz HTTP POST para sync-orchestrator
        → sync-orchestrator sincroniza tudo
          → Resultado salvo em scheduled_sync_logs
```

### Horários padrão (pré-configurados)
O job padrão será criado com a expressão: `0 9,10,11,12,15,19,20,1 * * *` (UTC, equivalente a 06h,07h,08h,09h,12h,16h,17h,22h BRT)

### Arquivos criados/alterados
- 1 migration (extensões + tabelas)
- 1 SQL insert (job padrão no pg_cron)
- `supabase/functions/manage-scheduled-sync/index.ts` (novo)
- `src/pages/ScheduledSync.tsx` (novo)
- `src/App.tsx` (rota)
- `src/components/layout/AppSidebar.tsx` (sidebar)
- `supabase/config.toml` (função)

