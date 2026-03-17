

## Plano: Exportar Playground como Postman Collection

### Objetivo
O botão "Exportar Playground" deve gerar um arquivo `.postman_collection.json` completo e importável no Postman. O botão "Exportar Postman" será removido (redundante).

### Alterações

**1. `src/lib/playground-export.ts`**
- Alterar `downloadPlaygroundExport` para gerar uma Postman Collection v2.1 em vez do formato JSON customizado atual
- Reaproveitar a lógica já existente em `postman-collection.ts` (que já tem todos os endpoints mapeados corretamente no formato Postman)
- A função vai chamar `generatePostmanCollection` internamente e salvar como `hub-juridico-playground.postman_collection.json`

**2. `src/pages/ApiTesting.tsx`** (linhas 979-985)
- Remover o botão "Exportar Postman"
- Manter apenas o botão "Exportar Playground", que agora exporta no formato Postman
- Remover import de `downloadPostmanCollection`

### Resultado
Um único botão "Exportar Playground" que gera um arquivo `.postman_collection.json` completo, pronto para importar no Postman.

