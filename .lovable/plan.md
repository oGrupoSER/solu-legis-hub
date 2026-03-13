

## Plano: Melhorar visual dos documentos nos andamentos, adicionar filtro, e corrigir contadores

### Problemas identificados

1. **Documentos nos andamentos muito apagados**: usam `bg-muted/40` e cores fracas, difícil de identificar visualmente.
2. **Sem filtro por documento na aba Andamentos**: não há como filtrar andamentos que possuem ou não documentos vinculados.
3. **Contador de andamentos errado na listagem**: a query em `movementCounts` (linha 222) busca TODOS os movements sem filtrar por `processIds`, e atinge o limite de 1000 linhas do banco — processos com muitos andamentos ficam com contagem 0.
4. **Contador de documentos errado na listagem**: a query em `documentCounts` (linha 230) conta TODOS os documentos do processo, incluindo os vinculados a andamentos. Deve contar apenas documentos onde `cod_andamento IS NULL`.

### Alterações

**1. `src/components/processes/ProcessMovementsTab.tsx`**
- Trocar estilo dos documentos de `bg-muted/40` para fundo azul claro visível (`bg-blue-50 border border-blue-200`)
- Ícone e texto do documento com cor mais forte (`text-blue-700`)
- Botão "Abrir" com variante visível (outline azul)
- Adicionar filtro local no header: "Todos", "Com documentos", "Sem documentos"
- Filtrar a lista de andamentos renderizados conforme seleção

**2. `src/pages/ProcessMovements.tsx`**
- **movementCounts** (linha 218-228): Paginar a query para buscar todos os registros (loop com `.range()` de 1000 em 1000), ou filtrar por `processIds` quando disponíveis
- **documentCounts** (linha 230-239): Adicionar filtro `.is("cod_andamento", null)` para contar apenas documentos avulsos do processo (sem vínculo a andamento)

### Resultado
- Documentos dentro dos andamentos ficam visualmente destacados com cores azuis
- Filtro permite ver rapidamente quais andamentos têm documentos
- Contadores na listagem refletem os valores reais (407 andamentos, 0 documentos avulsos)

