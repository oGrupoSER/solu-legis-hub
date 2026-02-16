-- Add unique constraint on process_number for processes table (needed for ON CONFLICT upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'processes_process_number_key'
  ) THEN
    ALTER TABLE public.processes ADD CONSTRAINT processes_process_number_key UNIQUE (process_number);
  END IF;
END $$;

-- Add unique constraint on client_search_terms for deduplication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_search_terms_client_system_id_search_term_id_key'
  ) THEN
    ALTER TABLE public.client_search_terms ADD CONSTRAINT client_search_terms_client_system_id_search_term_id_key UNIQUE (client_system_id, search_term_id);
  END IF;
END $$;