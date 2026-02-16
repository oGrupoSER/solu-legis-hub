
# Plano Complementado: Controles de Seguranca Configuraveis via Interface

## Novo Requisito
Adicionar uma tela de gerenciamento de seguranca onde o administrador pode:
- Bloquear/desbloquear IPs especificos
- Bloquear/desbloquear tokens diretamente
- Configurar rate limits personalizados por cliente
- Visualizar tentativas de acesso bloqueadas

Este complemento se integra ao plano ja aprovado (API completa + volumetria + Postman).

---

## 1. Novas Tabelas

### api_ip_rules (regras de IP)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| ip_address | text | IP ou range CIDR (ex: 192.168.1.0/24) |
| rule_type | text | 'block' ou 'allow' |
| reason | text | Motivo do bloqueio |
| client_system_id | uuid (nullable) | Se vinculado a um cliente especifico, ou NULL para global |
| is_active | boolean | Se a regra esta ativa |
| created_by | text | Quem criou a regra |
| expires_at | timestamptz (nullable) | Bloqueio temporario (NULL = permanente) |
| created_at / updated_at | timestamptz | Timestamps |

### api_security_logs (log de bloqueios)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| ip_address | text | IP que tentou acessar |
| token_id | uuid (nullable) | Token usado (se identificado) |
| client_system_id | uuid (nullable) | Cliente (se identificado) |
| endpoint | text | Endpoint solicitado |
| block_reason | text | Motivo do bloqueio (ip_blocked, token_blocked, rate_limit, service_denied) |
| created_at | timestamptz | Quando ocorreu |

### api_delivery_cursors (do plano original - mantido)

Tabela de controle de lotes conforme ja planejado.

---

## 2. Alteracao na Tabela Existente: api_tokens

Adicionar colunas para controle granular por token:

| Coluna Nova | Tipo | Descricao |
|-------------|------|-----------|
| is_blocked | boolean (default false) | Bloqueio manual do token |
| blocked_reason | text (nullable) | Motivo do bloqueio |
| blocked_at | timestamptz (nullable) | Quando foi bloqueado |
| rate_limit_override | integer (nullable) | Limite customizado (NULL = usa padrao 1000/h) |
| allowed_ips | text[] (nullable) | Lista de IPs permitidos (NULL = todos) |

---

## 3. Evolucao do auth-middleware.ts

O middleware sera expandido para verificar na seguinte ordem:

```text
1. Validar token (existente)
2. Verificar se token esta bloqueado (is_blocked) -> NOVO
3. Verificar IP contra api_ip_rules (bloqueios globais e por cliente) -> NOVO
4. Verificar allowed_ips do token (whitelist) -> NOVO
5. Verificar rate limit (existente, agora com override por token) -> MELHORADO
6. Verificar acesso ao servico via client_system_services -> NOVO
7. Logar tentativas bloqueadas em api_security_logs -> NOVO
```

Todas as verificacoes retornam headers informativos:
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `X-Blocked-Reason` (quando bloqueado)

---

## 4. Nova Tela: Seguranca da API (dentro de Configuracoes ou como pagina dedicada)

Sera adicionada uma nova aba "Seguranca da API" na pagina de Configuracoes, com as seguintes secoes:

### 4.1 Gerenciamento de IPs Bloqueados
- Tabela listando todos os IPs com regras ativas
- Botao "Bloquear IP" abre dialog com campos: IP, motivo, escopo (global ou cliente especifico), tipo (permanente ou temporario com data de expiracao)
- Acoes: ativar/desativar regra, editar, excluir
- Indicador visual de regras expiradas

### 4.2 Gerenciamento de Tokens
- Visao consolidada de todos os tokens de todos os clientes
- Botao de bloqueio rapido com motivo obrigatorio
- Campo para definir rate limit customizado por token
- Campo para definir IPs permitidos (whitelist) por token
- Indicadores: ultimo uso, total de requests na ultima hora, status (ativo/bloqueado/expirado)

### 4.3 Log de Bloqueios (Seguranca)
- Tabela com tentativas de acesso bloqueadas
- Filtros por: tipo de bloqueio, IP, cliente, periodo
- Informacoes: IP, token usado, endpoint, motivo, data/hora
- Botao rapido para bloquear IP diretamente a partir de um log

### 4.4 Configuracoes Globais
- Rate limit padrao (default 1000 req/hora) - editavel
- Tamanho padrao do lote (default 500) - editavel
- Switch para habilitar/desabilitar verificacao de IP globalmente
- Switch para habilitar/desabilitar logging de seguranca

---

## 5. Integracao com o Plano Original

Tudo que ja foi planejado permanece. Este complemento adiciona:

| Componente do Plano Original | Complemento |
|-------------------------------|-------------|
| auth-middleware.ts | + verificacao de IP, bloqueio de token, whitelist de IPs |
| api-processes/distributions/publications | + headers de rate limit, + log de bloqueios |
| Playground (ApiTesting.tsx) | + indicadores visuais de seguranca do token selecionado |
| Postman Collection | Sem alteracao |
| api_delivery_cursors | Sem alteracao |

---

## 6. Arquivos a Modificar/Criar (Plano Completo Consolidado)

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar `api_delivery_cursors`, `api_ip_rules`, `api_security_logs` + alterar `api_tokens` |
| `supabase/functions/_shared/auth-middleware.ts` | Expandir com verificacao de IP, bloqueio de token, whitelist, logging de seguranca |
| `supabase/functions/api-processes/index.ts` | Reescrever com CRUD, isolamento por cliente, lotes, headers de seguranca |
| `supabase/functions/api-distributions/index.ts` | Reescrever com isolamento por cliente, lotes, headers |
| `supabase/functions/api-publications/index.ts` | Reescrever com isolamento por cliente, lotes, headers |
| `src/pages/ApiTesting.tsx` | Redesign completo do playground |
| `src/lib/postman-collection.ts` | Novo - gerador de colecao Postman |
| `src/pages/Settings.tsx` | Adicionar aba "Seguranca da API" com gestao de IPs, tokens e logs |
| `src/components/settings/IpRulesManager.tsx` | Novo - componente de gestao de regras de IP |
| `src/components/settings/TokenSecurityManager.tsx` | Novo - componente de gestao de seguranca de tokens |
| `src/components/settings/SecurityLogsTable.tsx` | Novo - tabela de logs de bloqueio |
| `src/components/settings/GlobalSecuritySettings.tsx` | Novo - configuracoes globais de seguranca |

---

## 7. Resumo Completo de Controles de Seguranca

| Controle | Configuravel em Tela? | Descricao |
|----------|----------------------|-----------|
| Bloqueio de IP | Sim | Bloquear IPs especificos (global ou por cliente), temporario ou permanente |
| Bloqueio de Token | Sim | Desativar token imediatamente com motivo |
| Whitelist de IPs por Token | Sim | Restringir token a IPs especificos |
| Rate Limit por Token | Sim | Definir limite customizado por token |
| Rate Limit Global | Sim | Alterar o limite padrao do sistema |
| Tamanho do Lote | Sim | Configurar max registros por request |
| Verificacao de Servico | Existente | Via client_system_services (ja implementado) |
| Logging de Bloqueios | Sim | Visualizar e filtrar tentativas bloqueadas |
| Confirmacao de Lotes | Via API | Cliente confirma recebimento antes de novos dados |

