

# Plano: Filtros Avancados e Indicador de Confirmacao por Registro

## Contexto

As telas de Publicacoes, Distribuicoes e Andamentos precisam de:
1. Filtros por **cliente**, **parceiro** e **periodo** (algumas telas ja tem parceiro/periodo parcialmente)
2. Indicador visual por registro mostrando se o cliente ja **confirmou o recebimento**
3. Ao clicar no indicador, exibir **data/hora** e **IP de origem** da confirmacao
4. Filtro por status de confirmacao (confirmado / nao confirmado)

## Analise do Estado Atual

| Tela | Filtro Cliente | Filtro Parceiro | Filtro Periodo | Confirmacao |
|------|---------------|-----------------|----------------|-------------|
| Publicacoes (PublicationsTable) | Nao tem | Tem | Tem | Nao tem |
| Distribuicoes (Distributions) | Nao tem | Nao tem | Nao tem | Nao tem |
| Andamentos (ProcessMovements) | Nao tem | Nao tem | Nao tem | Nao tem |

O modelo de confirmacao atual e por **lote** (tabela `api_delivery_cursors`), sem rastreamento por registro individual. Nao ha dados de IP nem timestamp por registro.

## O Que Sera Feito

### 1. Nova Tabela: `record_confirmations`

Rastreia confirmacoes individuais por registro e por cliente:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| record_id | uuid NOT NULL | ID do registro (publicacao, distribuicao ou movimento) |
| record_type | text NOT NULL | "publications", "distributions" ou "movements" |
| client_system_id | uuid NOT NULL | Cliente que confirmou |
| confirmed_at | timestamptz | Data/hora da confirmacao |
| ip_address | text | IP de origem da requisicao |
| created_at | timestamptz | Timestamp de criacao |

Indice unico em (record_id, record_type, client_system_id) para evitar duplicatas.
RLS: SELECT para authenticated, INSERT para service role.

### 2. Atualizar Endpoints de Confirmacao (api-processes, api-distributions, api-publications)

Quando o cliente chama `POST ?action=confirm`:
- Alem de atualizar o `api_delivery_cursors`, inserir registros na tabela `record_confirmations` para cada item do lote entregue
- Capturar o IP da requisicao via headers (`x-forwarded-for` ou `x-real-ip`)
- Gravar o timestamp da confirmacao

### 3. Adicionar Filtros nas 3 Telas

**Publicacoes (PublicationsTable.tsx):**
- Adicionar filtro por **Cliente** (Select com client_systems)
- Filtro de confirmacao ja e viavel apos a nova tabela

**Distribuicoes (Distributions.tsx):**
- Adicionar filtro por **Parceiro** (Select com partners)
- Adicionar filtro por **Cliente** (Select com client_systems)
- Adicionar filtro por **Periodo** (DateRangePicker reutilizado)

**Andamentos (ProcessMovements.tsx):**
- Adicionar filtro por **Parceiro** (via processes.partner_id)
- Adicionar filtro por **Cliente** (via client_processes)
- Adicionar filtro por **Periodo** (DateRangePicker)

### 4. Indicador Visual de Confirmacao

Em cada linha da tabela, adicionar uma coluna "Confirmacao" com:
- Icone verde (CheckCircle) se pelo menos um cliente confirmou
- Icone cinza (Circle) se nenhum cliente confirmou ainda
- Ao clicar, abrir um **Popover/Dialog** com a lista de clientes que confirmaram, mostrando:
  - Nome do cliente
  - Data e hora da confirmacao
  - IP de origem

### 5. Filtro por Status de Confirmacao

Adicionar Select com 3 opcoes em cada tela:
- "Todos" (sem filtro)
- "Confirmados" (registros com pelo menos 1 entrada em record_confirmations)
- "Nao confirmados" (registros sem entrada)

Para filtrar, utilizar subquery ou left join com record_confirmations.

---

## Detalhes Tecnicos

### Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela `record_confirmations` com indices e RLS |
| `src/components/publications/PublicationsTable.tsx` | Adicionar filtro por cliente e confirmacao, coluna de status |
| `src/pages/Distributions.tsx` | Adicionar filtros por parceiro, cliente, periodo e confirmacao |
| `src/pages/ProcessMovements.tsx` | Adicionar filtros por parceiro, cliente, periodo e confirmacao |
| `supabase/functions/api-publications/index.ts` | Gravar record_confirmations no confirm |
| `supabase/functions/api-distributions/index.ts` | Gravar record_confirmations no confirm |
| `supabase/functions/api-processes/index.ts` | Gravar record_confirmations no confirm |

### Componente Reutilizavel: ConfirmationBadge

Criar componente `src/components/shared/ConfirmationBadge.tsx` que:
- Recebe `recordId` e `recordType`
- Consulta `record_confirmations` para esse registro
- Exibe icone verde/cinza
- Ao clicar, abre Popover com detalhes (cliente, data/hora, IP)

### Logica de Filtragem por Confirmacao

Para filtrar registros confirmados/nao confirmados sem degradar performance:
- Buscar IDs confirmados via query separada em `record_confirmations` filtrada por `record_type`
- Aplicar filtro `.in('id', confirmedIds)` ou `.not.in('id', confirmedIds)` na query principal
- Limitar a subquery ao tipo de registro da tela atual

### Captura de IP nos Endpoints

```text
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || req.headers.get('x-real-ip')
  || 'unknown';
```

### Filtro por Cliente nas Publicacoes/Distribuicoes

Como publicacoes e distribuicoes nao tem link direto com `client_systems`, o filtro por cliente funcionara via:
- Publicacoes: `client_search_terms` -> `search_terms` -> `publications.matched_terms` (pelo termo)
- Distribuicoes: `client_search_terms` -> `search_terms` -> `distributions.term` (pelo termo)
- Andamentos: `client_processes` -> `processes` -> `process_movements.process_id` (direto)

