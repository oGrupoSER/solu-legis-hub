
Objetivo
- Corrigir os indicadores de status em `/processes/movements` para exibir todos os status distintos retornados pela integração (incluindo `SEGREDO`) e permitir filtro por clique no indicador.

Plano de implementação

1) Ajustar a base de dados usada na tela de Movimentações
- Em `src/pages/ProcessMovements.tsx`, remover o filtro fixo `.eq("status_code", 4)` da busca de processos.
- Incluir no select dos processos os campos de status necessários (`status_code`, `status_description`, `status`, `raw_data`) para montar indicadores corretos.
- Trocar carregamentos com limite implícito/baixo por paginação incremental (`.range()` em loop) nas consultas que alimentam indicadores, evitando perda de registros por limite padrão.

2) Criar indicadores de status por distinct (clicáveis)
- Adicionar estado `filterStatus` na página.
- Gerar grupos de status por distinct a partir dos processos carregados (contagem por status).
- Renderizar cards de status (incluindo “Todos”), com destaque visual do card ativo.
- Ao clicar no card, aplicar o filtro de status selecionado.

3) Aplicar o filtro de status no conteúdo da página
- Processos (aba “Processos”): exibir somente processos do status clicado.
- Andamentos (aba “Andamentos”): filtrar andamentos pelos `process_id` dos processos do status selecionado, para manter consistência da navegação.
- Recalcular paginação e estados vazios com base no conjunto filtrado.

4) Tornar o status visível na listagem da aba Processos
- Adicionar coluna “Status” na tabela da aba “Processos” para deixar claro o resultado do filtro por indicador.
- Ajustar `colSpan` e textos de estado vazio/carregamento conforme novo layout.

5) Garantir compatibilidade com status brutos da integração
- Normalizar o label do status com fallback para o valor bruto (`raw_data.status`) quando houver inconsistência histórica, garantindo que casos como `SEGREDO` apareçam no indicador mesmo em registros antigos.
- (Opcional, recomendado) Em `supabase/functions/sync-process-management/index.ts`, persistir também o status bruto em `status` e evitar colapsar status não mapeados em “Validando”, preservando distinct real da API para futuros syncs.

Detalhes técnicos
- Arquivo principal: `src/pages/ProcessMovements.tsx`
  - Novos estados: `filterStatus`.
  - Novos cálculos derivados: `statusGroups`, `filteredProcesses`, `filteredMovements`.
  - Queries com paginação incremental para não perder dados.
  - UI dos cards com `Card` + `ring` para ativo (mesmo padrão usado em `/processes`).
- Arquivo opcional (robustez futura): `supabase/functions/sync-process-management/index.ts`
  - Refinar fallback de status para preservar o status textual de origem quando não houver mapeamento explícito.

Validação (aceite)
- Em `/processes/movements`, os indicadores exibem todos os status distintos disponíveis.
- O status `SEGREDO` aparece como indicador quando existir no retorno sincronizado.
- Clique em um indicador filtra corretamente os resultados.
- Clique em “Todos” remove o filtro.
- Paginação/contagens permanecem coerentes após aplicar e limpar filtros.
