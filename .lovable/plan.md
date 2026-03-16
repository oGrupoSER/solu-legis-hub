

## Plano: Tabs 100% largura e ordem invertida

### Alterações em `src/pages/ApiTesting.tsx`

**1. Inverter ordem das tabs (linha 776):**
```typescript
const allTabs = ["publications", "distributions", "processes"];
```

**2. Inverter ordem dos TabsTrigger (linhas 832-834):**
```
Publicações | Distribuições | Processos
```

**3. TabsList 100% largura (linha 831):**
```tsx
<TabsList className="grid w-full grid-cols-3">
```

Também mudar o `defaultValue` do Tabs para `"publications"` (primeira aba visível).

