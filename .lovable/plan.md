

## Plano: Corrigir colunas `integer` para `bigint` nos códigos da Solucionare

### Problema raiz

Os códigos da API Solucionare (ex: `codAndamento = 2361418468`) excedem o limite do tipo `integer` do PostgreSQL (~2.1 bilhões). O upsert falha com:

```
value "2361418468" is out of range for type integer
```

Isso impede que andamentos e documentos do processo `104795496` sejam salvos na base.

### Diagnóstico

- A tabela `process_movements` tem `cod_andamento integer` → precisa ser `bigint`
- A tabela `process_documents` tem `cod_andamento integer` e `cod_documento integer` → ambos precisam ser `bigint`
- Outros campos `cod_*` em diversas tabelas também podem ultrapassar o limite no futuro

### Alteração

**1. Migração SQL** — Alterar as colunas críticas de `integer` para `bigint`:

```sql
-- process_movements
ALTER TABLE process_movements ALTER COLUMN cod_andamento TYPE bigint;
ALTER TABLE process_movements ALTER COLUMN cod_agrupador TYPE bigint;

-- process_documents  
ALTER TABLE process_documents ALTER COLUMN cod_documento TYPE bigint;
ALTER TABLE process_documents ALTER COLUMN cod_andamento TYPE bigint;
ALTER TABLE process_documents ALTER COLUMN cod_processo TYPE bigint;
ALTER TABLE process_documents ALTER COLUMN cod_agrupador TYPE bigint;

-- process_groupers
ALTER TABLE process_groupers ALTER COLUMN cod_agrupador TYPE bigint;
ALTER TABLE process_groupers ALTER COLUMN cod_processo TYPE bigint;

-- process_dependencies
ALTER TABLE process_dependencies ALTER COLUMN cod_dependencia TYPE bigint;
ALTER TABLE process_dependencies ALTER COLUMN cod_processo TYPE bigint;

-- process_covers
ALTER TABLE process_covers ALTER COLUMN cod_agrupador TYPE bigint;
ALTER TABLE process_covers ALTER COLUMN cod_processo TYPE bigint;

-- processes
ALTER TABLE processes ALTER COLUMN cod_processo TYPE bigint;
ALTER TABLE processes ALTER COLUMN cod_escritorio TYPE bigint;
```

**2. Nenhuma alteração de código** — O TypeScript/JavaScript trata números grandes nativamente. As interfaces usam `number | null` que suporta valores `bigint` do Postgres.

### Resultado esperado

Após a migração, re-executar a sincronização irá:
- Salvar os 500 andamentos do processo `104795496`
- Salvar os 85 documentos vinculados aos andamentos via `cod_andamento`
- Exibir andamentos na aba "Andamentos" e documentos na aba "Documentos" da página do processo

