

## Problema

Ao clicar em "Editar" na tabela, o código faz `setEditTerm(term)` (linha 806), que abre o dialog via `open={!!editTerm}`. Porém, `handleOpenChange(true)` nunca é chamado nesse fluxo — ele só é chamado pelo dialog internamente. Resultado: `populateEdit()` nunca executa e o formulário fica com os valores padrão (nome vazio).

## Solução

Adicionar um `useEffect` no componente `DistributionTermDialog` que chama `populateEdit()` quando `editTerm` muda e o dialog está aberto.

| Arquivo | Mudança |
|---------|---------|
| `src/pages/DistributionTerms.tsx` | Adicionar `useEffect` com dependência em `editTerm` que chama `populateEdit()` quando `editTerm` é definido |

### Código

No `DistributionTermDialog`, após a definição de `populateEdit()` (linha ~406), adicionar:

```typescript
useEffect(() => {
  if (editTerm && open) {
    populateEdit();
  }
}, [editTerm, open]);
```

Isso garante que ao abrir o dialog de edição, o campo "Nome para Monitorar" e todos os outros campos venham preenchidos com os dados do termo selecionado.

