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