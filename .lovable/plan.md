

## Plano: Migrar Cadastro de Termos para API REST V2 da Solucionare

### Contexto
O cadastro de termos atualmente usa SOAP. O usuário quer migrar para a API REST V2 (`https://atacadoinformacaojudicial.com.br/WebApiPublicacoesV2/api/`), seguindo o fluxo: Autenticar → Cadastrar Nome → (OAB) → Buscar Catálogo → Cadastrar Abrangência.

### 1. Nova Edge Function: `register-publication-term`

Função dedicada ao fluxo completo de cadastro via REST V2:

```text
Fluxo sequencial:
1. POST /Autenticacao/AutenticaAPI  → tokenJWT
   Body: { nomeRelacional, token }  (vêm da partner_services)

2. POST /Nome/nome_cadastrar  → codNome
   Bearer: tokenJWT
   Body: [{ codEscritorio: 41, nome: "TERMO" }]

3. Se OAB preenchida:
   POST /Oab/oab_Cadastrar
   Bearer: tokenJWT
   Body: [{ codNome, uf: "RS", numero: "040911", letra: "s" }]

4. GET /Abrangencia/abrangencia_buscarCatalogo
   Bearer: tokenJWT
   → extrair todos os codDiario do retorno

5. POST /Abrangencia/abrangencia_cadastrar
   Bearer: tokenJWT
   Body: { codNome, listCodDiarios: [434, 718, ...] }
```

- `codEscritorio` fixo = 41
- `nomeRelacional` e `token` obtidos da tabela `partner_services`
- Após sucesso, salva o termo localmente em `search_terms` com `solucionare_code = codNome`

### 2. Alterações no Frontend (`SearchTermDialog.tsx`)

**Campo OAB com máscara:**
- Separar em dois campos: Número (6 dígitos, máscara `000000`) e UF (select com estados válidos, uppercase)
- Formato interno: `{ numero: "040911", uf: "RS" }`
- Validação: número deve ter exatamente 6 dígitos, UF válida

**Submit:**
- Substituir a chamada atual (insert direto no Supabase + SOAP via `manage-search-terms`) por uma única chamada à nova Edge Function `register-publication-term`
- A Edge Function faz todo o fluxo (auth → nome → oab → abrangência → salvar local)

### 3. Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/register-publication-term/index.ts` | **Criar** - Nova Edge Function com fluxo REST V2 completo |
| `src/components/terms/SearchTermDialog.tsx` | **Modificar** - Campo OAB com máscara (número 6 dígitos + UF select), submit chama nova Edge Function |
| `supabase/config.toml` | Não editar (deploy automático) |

### Detalhes Técnicos

**Edge Function** recebe:
```json
{
  "service_id": "uuid",
  "nome": "TERMO CADASTRADO",
  "oab": { "numero": "040911", "uf": "RS" },  // opcional
  "client_ids": ["uuid1"]
}
```

Retorna:
```json
{
  "success": true,
  "codNome": 637719,
  "oab_registered": true,
  "abrangencia_count": 450
}
```

**Máscara OAB no frontend:**
- Campo número: `maxLength={6}`, aceita só dígitos, padding com zeros à esquerda
- Campo UF: Select com os 27 estados brasileiros
- Placeholder: "040911" / "RS"

