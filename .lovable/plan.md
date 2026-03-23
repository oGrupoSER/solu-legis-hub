

## Plano: Corrigir Filtro de Documentos na API de Processos

### Problema
Na linha 163 do `api-processes/index.ts`, o endpoint filtra documentos com `.not('storage_path', 'is', null)` — só retorna documentos já baixados para o storage local. Como nenhum dos 48 documentos foi baixado (todos têm `storage_path = null`), o Infojudiciais recebe lista vazia de documentos.

Os documentos têm `documento_url` válida (links externos da Solucionare) e devem ser acessíveis mesmo sem download local.

### Correção

**`supabase/functions/api-processes/index.ts`** — Linha 158-164

Remover o filtro `.not('storage_path', 'is', null)` e substituir por um filtro que retorne documentos que tenham **ou** `storage_path` **ou** `documento_url`:

```typescript
if (includes.includes('documents')) {
  const { data: documents } = await supabase
    .from('process_documents')
    .select('*')
    .eq('process_id', id)
    .or('storage_path.not.is.null,documento_url.not.is.null');
  result.documents = documents || [];
}
```

Isso garante que qualquer documento com URL externa ou arquivo local será retornado ao Infojudiciais.

### Arquivo alterado
- `supabase/functions/api-processes/index.ts`

