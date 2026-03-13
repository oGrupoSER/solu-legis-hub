
## Plano: corrigir busca exata por Número do Processo e Código em `/processes` e `/processes/movements`

### Objetivo
Fazer a busca rápida retornar apenas registros que correspondam ao **Número do Processo** ou ao **Código** informado, sem resultados “parecidos” e sem trazer linhas não relacionadas.

### Causa raiz identificada
1. A busca atual usa filtros amplos (`ilike` + colunas extras como tribunal/descrição), então retorna resultados não exatos.
2. Há uso de `cod_processo::text` nos filtros do client, que é frágil no contexto da API e pode causar comportamento inconsistente.
3. Em `/processes/movements` (aba Andamentos), a query limita em 500 andamentos globais e depois filtra em memória; isso pode não incluir o processo pesquisado.

### Implementação proposta

1. **Padronizar regra de busca (exata)**
   - Criar regra única: comparar apenas:
     - `process_number`
     - `cod_processo`
   - Remover busca por campos não solicitados (ex.: `tribunal`, `description`, `tipo_andamento`, `cod_andamento` para essa busca rápida).

2. **`src/components/processes/ProcessesTable.tsx`**
   - Trocar filtro atual por busca segura e exata (sem cast `::text`).
   - Aplicar normalização (trim e comparação consistente) para evitar falso negativo por formatação.
   - Em erro de query, limpar lista local para não manter resultados antigos (evita “mostrar processos diferentes da pesquisa”).

3. **`src/pages/ProcessMovements.tsx` – fonte dos processos**
   - Ajustar `fetchAllProcesses` para remover filtro amplo atual.
   - Aplicar filtro exato no conjunto de processos carregado, usando só número/código.
   - Garantir que o mesmo `searchQuery` gere o mesmo comportamento da tela `/processes`.

4. **`src/pages/ProcessMovements.tsx` – aba Andamentos**
   - Incluir `cod_processo` no relacionamento `processes(...)` da query de andamentos.
   - Quando houver pesquisa, restringir query por `process_id` dos processos já filtrados (em vez de depender dos 500 mais recentes).
   - Remover filtro client-side por campos não desejados; manter apenas número/código do processo relacionado.

5. **Consistência visual**
   - Manter o placeholder atual, mas com comportamento efetivo alinhado ao texto.
   - Sem mudanças de banco de dados.

### Validação (E2E)
1. Em `/processes`, pesquisar pelo número completo `0002794-44.2018.8.16.0033` e validar retorno exato.
2. Em `/processes`, pesquisar pelo código `104795496` e validar retorno exato.
3. Repetir os dois testes em `/processes/movements` (abas Processos e Andamentos).
4. Testar com espaços extras no início/fim para confirmar robustez.
5. Confirmar que não aparecem resultados por tribunal/descrição quando busca for número/código.

### Detalhes técnicos
- Não haverá alteração de schema/RLS/migrations.
- Mudança é somente em lógica de consulta e filtragem front-end.
- O foco é previsibilidade: busca exata por chave de negócio (número/código), evitando “contains” em campos irrelevantes.
