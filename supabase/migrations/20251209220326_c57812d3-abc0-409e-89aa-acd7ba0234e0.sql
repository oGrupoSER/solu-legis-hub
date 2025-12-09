-- Adicionar UNIQUE constraints para process_covers e process_parties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_covers_process_id_cod_agrupador_key'
  ) THEN
    ALTER TABLE public.process_covers ADD CONSTRAINT process_covers_process_id_cod_agrupador_key UNIQUE (process_id, cod_agrupador);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_parties_cod_processo_polo_cod_agrupador_key'
  ) THEN
    ALTER TABLE public.process_parties ADD CONSTRAINT process_parties_cod_processo_polo_cod_agrupador_key UNIQUE (cod_processo_polo, cod_agrupador);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_lawyers_cod_processo_polo_num_oab_key'
  ) THEN
    ALTER TABLE public.process_lawyers ADD CONSTRAINT process_lawyers_cod_processo_polo_num_oab_key UNIQUE (cod_processo_polo, num_oab);
  END IF;
END $$;