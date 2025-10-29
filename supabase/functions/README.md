# SoluLegisHub - Edge Functions Documentation

## Overview

This document describes all Edge Functions in the SoluLegisHub system, their purposes, and how to use them.

---

## Synchronization Functions (Internal - Require JWT)

### 1. `sync-processes`
**Purpose**: Sync legal process movements from Solucionare API V3.

**Endpoints**:
- `CadastraNovoProcesso`: Register new process for monitoring
- `BuscaNovosAndamentos`: Fetch new movements
- `BuscaProcessos`: List registered processes

**Configuration**: Requires `verify_jwt = true`

---

### 2. `sync-distributions`
**Purpose**: Sync new case distributions from Solucionare WebAPI.

**Endpoints**:
- `BuscaNovasDistribuicoes`: Fetch unconsumed distributions
- `ConfirmaRecebimentoDistribuicoes`: Confirm receipt

**Configuration**: Requires `verify_jwt = true`

---

### 3. `manage-publication-terms`
**Purpose**: Manage search terms for official diary publications via SOAP.

**SOAP Methods**:
- `cadastrar`: Register new office/term
- `setEscritorio`: Edit office
- `remover`: Remove term
- `buscarEscritorios`: List offices
- `buscarNomesPesquisa`: List search terms

**Configuration**: Requires `verify_jwt = true`

---

### 4. `sync-publications`
**Purpose**: Sync official diary publications via SOAP.

**SOAP Methods**:
- `getPublicacoesPeriodo`: Fetch by period
- `getPublicacoes`: Fetch new publications
- `confirmaRecebimentoPublicacao`: Confirm receipt

**Configuration**: Requires `verify_jwt = true`

---

### 5. `sync-orchestrator`
**Purpose**: Orchestrate all synchronization functions.

**Features**:
- Parallel execution: `sync-distributions`, `sync-processes`
- Sequential: `manage-publication-terms` → `sync-publications`
- Centralized error handling
- Consolidated logging

**Configuration**: Requires `verify_jwt = true`

---

## API Functions (External - Token Authentication)

### 6. `api-processes`
**Purpose**: Query legal processes and movements.

**Authentication**: API Token via `Authorization: Bearer <token>`

**Endpoints**:

#### `GET /api-processes`
List processes with filters.

**Query Parameters**:
- `numero` (string): Process number
- `tribunal` (string): Court name
- `instancia` (string): Instance level
- `status` (string): Process status
- `limit` (integer, default: 100): Results per page
- `offset` (integer, default: 0): Pagination offset

**Response**:
```json
{
  "data": [...],
  "count": 150,
  "limit": 100,
  "offset": 0
}
```

#### `GET /api-processes/:id/movements`
Get movements for a specific process.

**Response**:
```json
{
  "data": [...],
  "count": 25
}
```

**Rate Limit**: 1000 requests/hour per token

**Configuration**: `verify_jwt = false` (uses token auth)

---

### 7. `api-distributions`
**Purpose**: Query case distributions.

**Authentication**: API Token via `Authorization: Bearer <token>`

**Endpoints**:

#### `GET /api-distributions`
List distributions with filters.

**Query Parameters**:
- `termo` (string): Search term
- `tribunal` (string): Court name
- `data_inicial` (string, YYYY-MM-DD): Start date
- `data_final` (string, YYYY-MM-DD): End date
- `limit` (integer, default: 100): Results per page
- `offset` (integer, default: 0): Pagination offset

**Response**:
```json
{
  "data": [...],
  "count": 75,
  "limit": 100,
  "offset": 0
}
```

**Rate Limit**: 1000 requests/hour per token

**Configuration**: `verify_jwt = false`

---

### 8. `api-publications`
**Purpose**: Query official diary publications.

**Authentication**: API Token via `Authorization: Bearer <token>`

**Endpoints**:

#### `GET /api-publications`
List publications with filters.

**Query Parameters**:
- `termo` (string): Search term
- `diario` (string): Gazette name
- `data_inicial` (string, YYYY-MM-DD): Start date
- `data_final` (string, YYYY-MM-DD): End date
- `limit` (integer, default: 100): Results per page
- `offset` (integer, default: 0): Pagination offset

**Response**:
```json
{
  "data": [...],
  "count": 200,
  "limit": 100,
  "offset": 0
}
```

**Rate Limit**: 1000 requests/hour per token

**Configuration**: `verify_jwt = false`

---

### 9. `api-webhook`
**Purpose**: Send webhook notifications to client systems.

**Authentication**: Requires JWT (internal use)

**Endpoints**:

#### `POST /api-webhook`
Trigger webhook notifications.

**Request Body**:
```json
{
  "event": "process.new" | "process.updated" | "distribution.new" | "publication.new",
  "data": {...},
  "clientSystemIds": ["uuid1", "uuid2"] // optional
}
```

**Response**:
```json
{
  "message": "Webhooks sent",
  "sent": 5,
  "total": 5,
  "results": [...]
}
```

**Webhook Payload** (sent to client systems):
```json
{
  "event": "process.new",
  "data": {...},
  "timestamp": "2025-10-29T12:00:00Z"
}
```

**Headers** (sent to client webhook URL):
- `Content-Type: application/json`
- `User-Agent: SoluLegisHub-Webhook/1.0`
- `X-Webhook-Signature: <hmac_sha256_signature>` (if secret is configured)

**Signature Verification** (client-side):
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}
```

**Configuration**: `verify_jwt = true`

---

## Shared Utilities

### `_shared/auth-middleware.ts`
- Token validation
- Rate limiting (1000 req/hour)
- Request logging

### `_shared/soap-client.ts`
- SOAP envelope construction
- XML parsing
- Error handling

### `_shared/rest-client.ts`
- HTTP client with retry logic
- Automatic authentication
- Request/response logging

### `_shared/logger.ts`
- Centralized logging
- Database log persistence
- Error formatting

### `_shared/service-config.ts`
- Service configuration fetching
- Credential validation
- Configuration caching

---

## Testing API Endpoints

### Example: Test API Process Query

```bash
# Set your token
TOKEN="your-api-token-here"

# Query processes
curl -X GET \
  "https://giprsjtilgbemsiwtjkx.supabase.co/functions/v1/api-processes?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Query specific process movements
curl -X GET \
  "https://giprsjtilgbemsiwtjkx.supabase.co/functions/v1/api-processes/{process-id}/movements" \
  -H "Authorization: Bearer $TOKEN"
```

### Example: Test API Distributions Query

```bash
# Query distributions by date range
curl -X GET \
  "https://giprsjtilgbemsiwtjkx.supabase.co/functions/v1/api-distributions?data_inicial=2025-01-01&data_final=2025-10-29" \
  -H "Authorization: Bearer $TOKEN"
```

### Example: Test API Publications Query

```bash
# Query publications by term
curl -X GET \
  "https://giprsjtilgbemsiwtjkx.supabase.co/functions/v1/api-publications?termo=escritorio" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Responses

All API functions return standard error responses:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes**:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid or expired token)
- `405`: Method Not Allowed
- `429`: Rate Limit Exceeded
- `500`: Internal Server Error

---

## Database Tables

### `api_tokens`
Stores API authentication tokens for client systems.

### `api_requests`
Logs all API requests for monitoring and analytics.

### `client_webhooks`
Stores webhook configurations for client systems.

### `partner_services`
Stores service configurations (URLs, credentials, etc.)

### `processes`, `process_movements`
Legal process data.

### `distributions`
Case distribution data.

### `publications`
Official diary publication data.

### `sync_logs`
Synchronization operation logs.

---

## Security Notes

1. **Token Management**: 
   - Tokens should be kept secure and rotated regularly
   - Use HTTPS for all API calls
   - Store tokens encrypted in your application

2. **Rate Limiting**:
   - 1000 requests per hour per token
   - Implement exponential backoff in clients

3. **Webhook Security**:
   - Always verify webhook signatures using the provided secret
   - Use HTTPS endpoints for webhook URLs
   - Implement idempotency to handle duplicate webhooks

4. **IP Filtering** (Future):
   - Consider adding IP whitelist for additional security

---

## Support

For issues or questions, contact the development team.
