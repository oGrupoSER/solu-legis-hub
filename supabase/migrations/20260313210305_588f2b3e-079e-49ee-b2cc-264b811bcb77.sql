
-- Drop old unique constraint on process_number
ALTER TABLE public.processes DROP CONSTRAINT IF EXISTS processes_process_number_key;

-- Add new columns
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS data_cadastro timestamptz;
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS cod_classificacao_status integer;
ALTER TABLE public.processes ADD COLUMN IF NOT EXISTS descricao_classificacao_status text;

-- Add new unique constraint on (process_number, instance)
ALTER TABLE public.processes ADD CONSTRAINT processes_process_number_instance_key UNIQUE (process_number, instance);
