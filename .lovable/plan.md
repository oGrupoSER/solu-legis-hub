

## Plano: Criar Endpoints Bulk na API do Hub para Andamentos, Documentos, Capas e Partes

### Contexto

Hoje o Infojudiciais precisa chamar `GET /api-processes/{id}?include=movements,documents,cover,parties` individualmente para cada um dos 300+ processos. Vamos criar 4 endpoints bulk que retornam todos os registros do cliente de uma vez, com paginação e confirmação de lote — mesmo padrão já usado em `api-publications` e `api-distributions`.

### Endpoints a criar

| Endpoint | Dados | Isolamento |
|---|---|---|
| `GET /api-processes?action=movements` | Andamentos de todos os processos do cliente | via `client_processes` |
| `GET /api-processes?action=documents` | Documentos de todos os processos do cliente | via `client_processes` |
| `GET /api-processes?action=covers` | Capas + partes + advogados | via `client_processes` |
| `GET /api-processes?action=parties` | Partes + advogados | via `client_processes` |

Cada um com:
- Paginação (`limit`, `offset`)
- Cursor de entrega isolado por `client_system_id` + `service_type` (ex: `process_movements`, `process_documents`, `process_covers`, `process_parties`)
- Confirmação via `POST /api-processes?action=confirm_movements`, `confirm_documents`, `confirm_covers`, `confirm_parties`
- Exclusão automática de registros já confirmados por aquele cliente (via `record_confirmations`)

### Alterações

**1. `supabase/functions/api-processes/index.ts`**

Expandir o handler para reconhecer as novas actions no GET:

- `action=movements`: Query `process_movements` filtrado por `process_id IN (client_processes do cliente)`, excluindo IDs já em `record_confirmations` para aquele `client_system_id`. Limite 500, com cursor.
- `action=documents`: Mesma lógica em `process_documents`.
- `action=covers`: Mesma lógica em `process_covers`, incluindo join com `process_parties` e `process_lawyers`.
- `action=parties`: Mesma lógica em `process_parties` com `process_lawyers`.

Para confirmação, adicionar handlers:
- `POST action=confirm_movements` / `confirm_documents` / `confirm_covers` / `confirm_parties`

Cada um segue o padrão existente: lê cursor, grava `record_confirmations` para os IDs entregues, marca cursor como confirmado.

**2. `src/pages/ApiTesting.tsx` (Playground)**

Adicionar as novas actions na lista do Playground para teste:
- `bulk_movements`, `bulk_documents`, `bulk_covers`, `bulk_parties`
- `confirm_movements`, `confirm_documents`, `confirm_covers`, `confirm_parties`

### Formato de resposta (mesmo padrão)

```json
{
  "data": [...],
  "pagination": { "total": 3058, "limit": 500, "offset": 0, "has_more": true },
  "batch": {
    "pending_confirmation": true,
    "records_in_batch": 500,
    "total_delivered": 500
  }
}
```

### Resultado

O Infojudiciais reduz de ~1.200 chamadas (300 processos x 4 tipos) para ~24 chamadas (4 tipos x ~6 lotes de 500 cada) + 4 confirmações.

### Arquivos alterados
- `supabase/functions/api-processes/index.ts` — adicionar handlers bulk GET + confirm POST
- `src/pages/ApiTesting.tsx` — adicionar actions do Playground

