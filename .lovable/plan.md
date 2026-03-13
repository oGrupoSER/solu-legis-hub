

## Plano: Ocultar "Desativar" e migrar exclusão para REST V2

### 1. `TermActionsDropdown.tsx` — Remover opção Ativar/Desativar + adicionar `solucionare_code` ao prop

- Adicionar `solucionare_code: number | null` na interface do prop `term`
- Remover todo o bloco de Ativar/Desativar (linhas 125-145) e o separador associado
- Manter apenas: Editar, Separador, Excluir
- No `handleDelete`, passar `cod_nome: term.solucionare_code` no body da chamada para a Edge Function

### 2. `handleDelete` — Chamar nova Edge Function REST V2

Atualmente chama `manage-search-terms` (SOAP). Mudar para chamar uma nova action ou Edge Function que:

1. Autentica via `POST /Autenticacao/AutenticaAPI` → tokenJWT
2. Chama `POST /Nome/nome_excluir` passando `[codNome]` no body com o tokenJWT
3. Deleta o registro local da tabela `search_terms`
4. Registra logs em `api_call_logs`

Vou adicionar isso diretamente na Edge Function `manage-search-terms` como uma nova action `excluir_nome_rest` que usa REST V2 ao invés de SOAP. Assim mantenho a estrutura existente.

### 3. `manage-search-terms/index.ts` — Nova action `excluir_nome_rest`

- Buscar `service_url`, `nome_relacional`, `token` do serviço
- `POST /Autenticacao/AutenticaAPI` com `{nomeRelacional, token}` → tokenJWT
- `POST /Nome/nome_excluir` com body `[codNome]` e header `Authorization: Bearer tokenJWT`
- Deletar registro local em `search_terms`
- Registrar chamadas em `api_call_logs`

### 4. Páginas que usam `TermActionsDropdown`

Atualizar `PublicationTerms.tsx` e `SearchTerms.tsx` para passar `solucionare_code` no prop `term`.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/terms/TermActionsDropdown.tsx` | Remover ativar/desativar, adicionar solucionare_code, chamar nova action |
| `supabase/functions/manage-search-terms/index.ts` | Adicionar action `excluir_nome_rest` via REST V2 |
| `src/pages/PublicationTerms.tsx` | Passar solucionare_code no prop term |
| `src/pages/SearchTerms.tsx` | Passar solucionare_code no prop term |

