

## Plano: Novo layout do Playground de API

### Layout atual
- **Esquerda**: Endpoints + Query Params + Body Params + Botão Executar + Exemplos de Código
- **Direita**: Resposta (card sticky)

### Novo layout proposto
- **Esquerda**: Apenas lista de endpoints (card com a lista)
- **Direita** (coluna principal):
  1. **Service ID + Body JSON / Query Params** (campos editáveis)
  2. **Botão Executar**
  3. **Resposta** (abaixo do botão)
  4. **Exemplos de Código** (colapsado ou abaixo)

### Alterações em `src/pages/ApiTesting.tsx` (linhas 1001-1163)

**Reestruturar o grid dentro de cada `TabsContent`:**

```text
┌─────────────────────┬──────────────────────────────────────┐
│  Endpoints          │  Body JSON / Parâmetros              │
│  (lista scrollável) │  [campos do endpoint selecionado]    │
│                     │                                      │
│                     │  [▶ Executar Requisição]              │
│                     │                                      │
│                     │  Resposta                             │
│                     │  [JSON response + status badge]       │
│                     │                                      │
│                     │  Exemplos de Código                   │
│                     │  [curl / js / python]                 │
└─────────────────────┴──────────────────────────────────────┘
```

- Grid muda de `lg:grid-cols-2` para layout com coluna esquerda fixa (~350px) e direita flexível
- Coluna esquerda: Card de Endpoints com `max-h` e `overflow-y-auto` para scroll
- Coluna direita: Query Params + Body Params + Executar + Resposta + Code Examples (tudo em sequência vertical)
- Card de Endpoints na esquerda fica `sticky top-4`

### Arquivo alterado
- `src/pages/ApiTesting.tsx`

