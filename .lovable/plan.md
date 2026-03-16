

## Diagnóstico: "Invalid action: rest_buscar_catalogo"

### Causa raiz

O código no repositório está correto — a linha 155 de `manage-search-terms/index.ts` verifica `action.startsWith('rest_')` e roteia para `handleRestV2Action`, que trata `rest_buscar_catalogo` na linha 972.

O erro "Invalid action" vem da linha 218 (default do switch SOAP), o que só acontece se o `action.startsWith('rest_')` não foi executado — indicando que a **edge function deployada não contém o código mais recente**.

### Solução

Redesployar a edge function `manage-search-terms` para que o código atualizado com o handler REST V2 entre em vigor.

Nenhuma alteração de código é necessária — apenas o redeploy da function.

