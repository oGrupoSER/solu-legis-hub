

## Plano: Exportar Playground apenas com endpoints visíveis + defaults automáticos

### Problema
1. O export Postman (`postman-collection.ts`) inclui endpoints de **Consulta** (query) que **não aparecem na tela** — a UI só mostra "Gerenciamento"
2. `codEscritorio` nos payloads de exemplo usa placeholders genéricos em vez do valor fixo `41`
3. `serviceId`/`service_id` nos payloads usa `UUID_DO_SERVICO` em vez do ID do serviço selecionado atualmente

### Solução

**Reescrever `playground-export.ts`** para gerar a Postman Collection diretamente a partir dos arrays de endpoints que a UI usa (`processEndpoints`, `distributionEndpoints`, `publicationEndpoints`), filtrando apenas `category === "management"` (exatamente o que o `renderEndpointList` mostra). Eliminar `postman-collection.ts` que é a fonte dos endpoints extras.

### Alterações

**1. `src/pages/ApiTesting.tsx`**
- Exportar os arrays de endpoints (`processEndpoints`, `distributionEndpoints`, `publicationEndpoints`) e o `managementActionMap` para uso externo
- Passar o ID do serviço selecionado para a função de export

**2. `src/lib/playground-export.ts`** — Reescrever completamente:
- Importar os arrays de endpoints e o action map de `ApiTesting.tsx`
- Filtrar apenas `category === "management"` (o que está visível na tela)
- Gerar Postman Collection v2.1 a partir desses endpoints filtrados
- Em todos os payloads de exemplo, substituir:
  - `codEscritorio` → valor fixo `41`
  - `serviceId` / `service_id` → receber como parâmetro o ID do serviço selecionado e usar como default
- Organizar em pastas por categoria (Publicações, Distribuições, Processos) com subfolder "Gerenciamento" apenas

**3. `src/lib/postman-collection.ts`** — Remover (não será mais usado)

**4. `src/pages/ApiTesting.tsx` (botão export)**
- Atualizar a chamada para passar o service ID selecionado junto com a baseUrl
- Se nenhum serviço estiver selecionado, usar placeholder

### Resultado
O arquivo `.postman_collection.json` exportado terá **exatamente** os mesmos endpoints visíveis na sidebar do Playground, com `codEscritorio: 41` e o `serviceId` do serviço ativo preenchidos automaticamente.

