

## Plano: Documentos com URL sempre "Disponível"

### Problema
Documentos com `documento_url` mas sem `storage_path` aparecem como "Pendente" e exigem download para o storage antes de poder abrir. O usuário quer que todos os documentos com URL sejam tratados como disponíveis e acessíveis diretamente.

### Alteração

**`src/components/processes/ProcessDocumentsTab.tsx`**

Mudar a lógica de disponibilidade:

1. `isStoredLocally` → renomear para `isAvailable`: retorna `true` se `documento_url` OU `storage_path` existir
2. `isExpired`: permanece como `!storage_path && !documento_url`
3. Remover conceito de "Pendente" — não há mais estado intermediário
4. Remover botão "Baixar Todos" e botão de download individual (ícone de download)
5. Todos os documentos com URL mostram badge "Disponível" (verde) + botão "Abrir"
6. Apenas documentos sem URL e sem storage ficam como "Expirado"
7. Remover contagem de `pendingCount` do header
8. No filtro, manter apenas "Todos" e "Disponíveis" (remover "Expirados" se desejado, ou manter)

