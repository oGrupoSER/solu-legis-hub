
## Objetivo
Em `/distributions/terms`:
1. Corrigir erro de Edge Function ao sincronizar/desativar (CORS).
2. Tornar a listagem espelho fiel da API Solucionare (`BuscaNomesCadastrados?codEscritorio=41`) — remover localmente o que não existir no parceiro.
3. Adicionar botão **Excluir** individual (chama `DELETE /ExcluirNome`).
4. Adicionar **seleção múltipla** com ações em lote (Desativar / Excluir), processadas sequencialmente com loading "X de Y".
5. Confirmação para exclusão em lote: usuário precisa digitar `EXCLUIR`.

---

## Alterações

### 1. `supabase/functions/manage-distribution-terms/index.ts`

**a) CORS headers completos** (linhas 11-14):
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

**b) Remover fallback de `distributions` em `listNames`** (linhas 253-278):
- Apagar o bloco `if (apiNames.length === 0) { … populating from distributions table … }`.
- Motivo: a tela deve mostrar **exatamente** o que vem de `BuscaNomesCadastrados`. Se a API retornar vazio, o orphan cleanup já existente removerá tudo localmente — mas para evitar limpar tudo quando há falha real de API, manter cleanup somente se `apiNames.length > 0` (já é o comportamento atual em linha 235).
- Adicional: quando `apiNames.length === 0` e a chamada **foi bem-sucedida** (não erro), também limpar todos os termos locais daquele serviço para garantir mirror fiel. Sinalizar isso com flag `apiSucceeded` capturada no try/catch.

**c) `deleteName` — simplificar** (linhas 484-514):
- Quando chamado **sem** `client_system_id` (caso da UI atual), sempre executar `DELETE /ExcluirNome` no parceiro e remover o registro local pelo `solucionare_code` ou `term`.
- Manter lógica de deduplicação somente quando `client_system_id` é informado (chamadas de API externa).

### 2. `src/pages/DistributionTerms.tsx`

**a) Estado novo** (após linha 575):
```ts
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [bulkAction, setBulkAction] = useState<null | 'deactivate' | 'delete'>(null);
const [bulkConfirmText, setBulkConfirmText] = useState('');
const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; action: string } | null>(null);
```

**b) Mutation de excluir individual** (após `deactivateMutation`):
```ts
const deleteMutation = useMutation({
  mutationFn: async (term: DistributionTerm) => {
    const serviceId = term.partner_services?.id;
    if (!serviceId) throw new Error('Serviço não encontrado');
    if (!term.solucionare_code) {
      // somente local
      await supabase.from('client_search_terms').delete().eq('search_term_id', term.id);
      await supabase.from('search_terms').delete().eq('id', term.id);
      return;
    }
    const { data, error } = await supabase.functions.invoke('manage-distribution-terms', {
      body: { action: 'deleteName', serviceId, codNome: term.solucionare_code, termo: term.term },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Erro ao excluir');
  },
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['distribution-terms'] }); toast.success('Nome excluído'); },
  onError: (e) => toast.error(`Erro: ${e.message}`),
});
```

**c) Função de processamento em lote** (sequencial):
```ts
const runBulk = async (action: 'deactivate' | 'delete') => {
  const ids = Array.from(selectedIds);
  const items = filteredTerms.filter(t => ids.includes(t.id));
  let ok = 0, fail = 0;
  for (let i = 0; i < items.length; i++) {
    setBulkProgress({ current: i + 1, total: items.length, action: action === 'delete' ? 'Excluindo' : 'Desativando' });
    try {
      if (action === 'delete') await deleteMutation.mutateAsync(items[i]);
      else await deactivateMutation.mutateAsync(items[i]);
      ok++;
    } catch { fail++; }
  }
  setBulkProgress(null);
  setSelectedIds(new Set());
  setBulkAction(null);
  setBulkConfirmText('');
  toast.success(`Processados: ${ok} sucesso, ${fail} falhas`);
  queryClient.invalidateQueries({ queryKey: ['distribution-terms'] });
};
```

**d) UI da tabela**:
- Adicionar coluna de checkbox (header com "select all" filtrado, linha com seleção individual).
- Adicionar botão **Excluir** (`Trash2`, vermelho) em cada linha, ao lado de Editar/Desativar — com `confirm("Excluir este nome no parceiro?")`.
- Acima da tabela (quando `selectedIds.size > 0`), barra de ações em lote: contador + botões "Desativar selecionados" / "Excluir selecionados".

**e) Diálogo de confirmação em lote** (`Dialog`):
- Mostra contagem.
- Para `delete`: input pedindo digitar `EXCLUIR` (botão habilitado só quando `bulkConfirmText === 'EXCLUIR'`).
- Para `deactivate`: confirmação simples.

**f) Diálogo de progresso** (`Dialog` modal não-fechável):
- Quando `bulkProgress` ativo: exibe `<Loader2 />` + "Excluindo 3 de 10..." e barra `<Progress />`.

---

## Arquivos a alterar
- `supabase/functions/manage-distribution-terms/index.ts`
- `src/pages/DistributionTerms.tsx`

## Edge functions a re-deploy
- `manage-distribution-terms` (auto)
