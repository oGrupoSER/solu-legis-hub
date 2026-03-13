

## Plano: Vincular documentos aos andamentos e separar aba Documentos

### Problema
Todos os documentos aparecem na aba "Documentos". Documentos que possuem `cod_andamento` devem aparecer dentro do andamento correspondente na aba "Andamentos", com botão de abrir. A aba "Documentos" deve mostrar apenas documentos sem `cod_andamento`.

### Alterações

**1. `src/components/processes/ProcessMovementsTab.tsx`**

- Buscar documentos do processo junto com os andamentos (query separada em `process_documents` filtrada por `process_id`)
- Agrupar documentos por `cod_andamento` em um Map
- Para cada andamento renderizado, exibir seus documentos vinculados abaixo da descrição
- Cada documento mostra nome/código + botão "Abrir" com link para `documento_url`

**2. `src/components/processes/ProcessDocumentsTab.tsx`**

- Adicionar filtro `.is("cod_andamento", null)` na query para mostrar apenas documentos sem vínculo a andamento
- Ajustar contagem e texto do header para refletir que são "Documentos do processo" (sem andamento)

### Resultado
- Aba **Andamentos**: cada andamento mostra seus documentos inline com botão "Abrir"
- Aba **Documentos**: mostra apenas documentos avulsos (sem `cod_andamento`)

