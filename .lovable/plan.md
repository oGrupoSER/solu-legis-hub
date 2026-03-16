

## Plano: Confirmação automática + Export do Playground

### Parte 1: Confirmar recebimento automaticamente durante sincronização

O Hub atualmente faz `BuscaNovas...` mas **não confirma** recebimento na Solucionare (há comentários "DISABLED" / "Skipping confirmation" em todos os sync functions). Precisamos ativar isso.

#### 1.1 Publicações (`sync-publications/index.ts`)
- Após `processPublications` retornar os IDs sincronizados, autenticar na REST V2 (`AutenticaAPI`) e chamar `POST /Publicacao/publicacao_confirmarRecebimento` com array de `codPublicacao` dos registros sincronizados.
- O `RestClient` atual usa auth em query params, mas o endpoint de confirmação usa Bearer JWT. Será necessário fazer um fetch direto com JWT (similar ao `restApiCall` do manage-search-terms).
- Adicionar função `confirmPublicationReceipt(service, codPublicacaoIds)` que autentica e confirma em lotes de 100.

#### 1.2 Distribuições (`sync-distributions/index.ts`)
- Após `syncDistributions`, chamar `POST /ConfirmaRecebimentoDistribuicoes?codEscritorio={code}` com body `{ distribuicoes: [{ codEscritorio, codProcesso }] }`.
- Usar o `jwtToken` já autenticado e a função `apiRequest` existente.
- Coletar `codProcesso` e `codEscritorio` dos registros sincronizados para montar o array.

#### 1.3 Andamentos/Processos (`sync-process-updates/index.ts`)
- Reativar a função `confirmReceipt` existente (linhas 898-953) que já está implementada mas DISABLED.
- Chamá-la após `syncMovements`, `syncDocuments`, `syncGroupers` e `syncDependencies` com os IDs coletados.
- Marcar `is_confirmed = true` localmente após confirmação bem-sucedida.

### Parte 2: Exportar Playground completo

Trocar o botão "Exportar Postman" por "Exportar Playground" que gera um documento JSON/Markdown abrangente contendo:

#### `src/lib/playground-export.ts` (novo arquivo)
- Extrair **todos** os endpoints definidos em `ApiTesting.tsx` (publicationEndpoints, distributionEndpoints, processEndpoints) com:
  - ID, label, method, path, description
  - Params e bodyParams completos com placeholders
  - Action mapping (managementActionMap)
  - Auth type (token vs jwt)
  - Edge Function target e action esperada
  - Exemplos de body JSON prontos
- Incluir seção de configuração:
  - Base URL pattern
  - Auth flow (como obter JWT, como usar API token)
  - Service types e como obtê-los
- Incluir mapeamento completo de **actions** para cada Edge Function
- Formato: JSON estruturado + Markdown legível

#### `src/pages/ApiTesting.tsx`
- Trocar botão para "Exportar Playground" 
- Chamar nova função de export

#### `src/lib/postman-collection.ts`
- Adicionar o endpoint "Confirmar Recebimento" de publicações na pasta de Gerenciamento de Publicações
- Adicionar o endpoint "Confirmar Recebimento" de distribuições

### Arquivos alterados
- `supabase/functions/sync-publications/index.ts` — adicionar confirmação automática após sync
- `supabase/functions/sync-distributions/index.ts` — adicionar confirmação automática após sync  
- `supabase/functions/sync-process-updates/index.ts` — reativar confirmReceipt nos fluxos de sync
- `src/lib/playground-export.ts` — novo arquivo de exportação completa
- `src/lib/postman-collection.ts` — adicionar endpoints de confirmação
- `src/pages/ApiTesting.tsx` — trocar botão de export

