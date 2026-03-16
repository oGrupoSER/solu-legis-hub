

## Plano: Estado inicial sem endpoint selecionado

### Problema
Ao entrar em `/api-testing`, a página já vem com o primeiro endpoint selecionado. O usuário quer que inicie sem nenhum endpoint selecionado, mostrando apenas a lista à esquerda e um estado vazio à direita.

### Alterações em `src/pages/ApiTesting.tsx`

**1. Tornar `selectedEndpoint` nullable:**
- Linha 683: `useState<EndpointDef | null>(null)` em vez de `useState<EndpointDef>(publicationEndpoints[0])`

**2. Ao trocar de aba, NÃO auto-selecionar:**
- Linha 993: remover `selectEndpoint(eps[0])` do `onValueChange` das tabs — apenas trocar a aba sem selecionar endpoint

**3. Guardar todos os acessos a `selectedEndpoint` com null-checks:**
- Linhas que usam `selectedEndpoint.params`, `selectedEndpoint.bodyParams`, `selectedEndpoint.authType`, etc. precisam de `?.` ou condicionais
- `buildUrl`, `buildBody`, `handleTest`, `codeExamples` — adicionar early returns quando `selectedEndpoint` é null

**4. Coluna direita — estado vazio quando nenhum endpoint selecionado:**
- Mostrar card com mensagem "Selecione um endpoint na lista à esquerda para começar" com ícone centralizado
- Quando há endpoint selecionado, mostrar o layout atual (params + executar + resposta + código)

**5. Remover bloco de Token/Auth no topo (linhas ~940-987):**
- Esse bloco fica fora do grid e não é necessário pois os endpoints de gerenciamento usam JWT automático. Removê-lo limpa a interface conforme o screenshot do usuário mostra.

### Arquivo alterado
- `src/pages/ApiTesting.tsx`

