

## Diagnóstico: Publicações sem termos vinculados na listagem

### Causa raiz

No `sync-publications/index.ts` (linha 86-87), a query de termos filtra por `term_type = 'publication'`:

```typescript
.eq('term_type', 'publication')
```

Mas os termos de publicação são cadastrados com `term_type = 'name'` ou `term_type = 'office'` (conforme a página PublicationTerms que filtra por `.in("term_type", ["name", "office"])`).

Resultado: a variável `terms` é sempre um array vazio, o matching local nunca encontra nada, e `matched_terms` é salvo como `[]` em todas as publicações.

Além disso, a API da Solucionare retorna campos como `nomePesquisado` no payload, mas o `processPublications` nunca mapeia esses campos para as colunas `nome_pesquisado` e `termo_pesquisado` da tabela — que já existem mas ficam sempre NULL.

### Correção

**1. `supabase/functions/sync-publications/index.ts`**

- **Linha 87**: Trocar `.eq('term_type', 'publication')` por `.in('term_type', ['name', 'office'])` para buscar os termos corretos
- **processPublications**: Além do matching local por conteúdo, usar o campo `nomePesquisado` da API como fonte primária para `matched_terms` e popular as colunas `nome_pesquisado` e `termo_pesquisado`
- Lógica: se a API retorna `nomePesquisado`, incluir no `matched_terms`; manter o matching local como complemento

**2. Migração SQL** (opcional mas recomendado)

- Atualizar publicações existentes que têm `matched_terms = '{}' ` mas possuem `raw_data->>'nomePesquisado'` preenchido, populando retroativamente os campos

### Arquivos alterados
- `supabase/functions/sync-publications/index.ts` — corrigir filtro de term_type e mapear campos da API

