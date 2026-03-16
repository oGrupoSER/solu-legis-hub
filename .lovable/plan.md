

## Plano: Ajustar badges GET e remover bloco Consulta

### 1. Remover bloco "Consulta" de todas as categorias

Em `renderEndpointList` (linhas 907-963), remover toda a seção que renderiza os endpoints de `category: "query"` (linhas 913-934 e o Separator 936-939). Manter apenas o bloco "Gerenciamento" com os `mgmtEps`.

Também remover os endpoints com `category: "query"` dos arrays `processEndpoints`, `distributionEndpoints` e `publicationEndpoints` (os blocos Listar, Detalhe e Confirmar Lote de cada categoria).

Como consequência, o seletor de Token no topo e toda lógica de token podem ser simplificados, mas vou mantê-los por ora caso sejam usados futuramente.

### 2. Mudar cor do badge GET no bloco Gerenciamento

Na linha 952, o badge de método nos endpoints de gerenciamento usa sempre `bg-amber-600`. Alterar para usar cor diferente quando o método for GET:
- **GET**: `variant="secondary"` com classe `bg-blue-100 text-blue-700` (azul, visual diferente do POST)
- **POST**: manter `bg-amber-600` atual

```tsx
<Badge 
  variant={ep.method === "GET" ? "secondary" : "default"} 
  className={`text-xs font-mono ${ep.method === "GET" ? "bg-blue-100 text-blue-700" : "bg-amber-600"}`}
>
  {ep.method}
</Badge>
```

### Arquivos alterados
- `src/pages/ApiTesting.tsx`

