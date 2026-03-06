

## Resumo do Fluxo Atual

Ao cadastrar um termo em `/publications/terms`:

1. **SOAP `cadastrar`** registra o nome no parceiro Solucionare
2. Salva o termo localmente na tabela `search_terms`
3. **Nenhuma publicação é baixada** -- o download só acontece manualmente ao ir em `/publications` e clicar "Sincronizar Novas"

Ou seja, o cadastro do termo funciona (registra no parceiro), mas as publicações correspondentes **não são capturadas automaticamente**.

---

## Plano: Disparar sync de publicações ao cadastrar termo

### Alteração no Frontend (`src/pages/PublicationTerms.tsx`)

Após o cadastro bem-sucedido de um termo (no callback `onSuccess` do dialog), invocar automaticamente `sync-publications` para o serviço REST de publicações do mesmo parceiro:

1. Buscar o `partner_id` do serviço de termos usado no cadastro
2. Encontrar o serviço REST de publicações (`service_type = 'publications'`) do mesmo parceiro
3. Chamar `supabase.functions.invoke('sync-publications', { body: { service_id } })`
4. Exibir toast informando: "Termo cadastrado! Buscando publicações..." seguido do resultado

### Fluxo resultante

```text
Usuário cadastra termo
  → SOAP cadastrar (já existe)
  → Salva em search_terms (já existe)
  → [NOVO] Invoca sync-publications automaticamente
  → Toast: "X publicações encontradas para o novo termo"
```

### Arquivos a modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PublicationTerms.tsx` | Adicionar chamada a `sync-publications` no callback de sucesso do cadastro |

Nenhuma alteração no backend necessária -- ambas as Edge Functions já existem e funcionam.

