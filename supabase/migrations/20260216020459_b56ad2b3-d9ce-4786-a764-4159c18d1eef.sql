
-- Add solucionare_status to search_terms (used by Publications and Distributions)
ALTER TABLE public.search_terms
ADD COLUMN solucionare_status text NOT NULL DEFAULT 'pending';

-- Add solucionare_status to processes
ALTER TABLE public.processes
ADD COLUMN solucionare_status text NOT NULL DEFAULT 'pending';

-- Update existing records that have solucionare_code as 'synced' (they were already registered)
UPDATE public.search_terms SET solucionare_status = 'synced' WHERE solucionare_code IS NOT NULL;

-- Update existing processes that have cod_processo as 'synced'
UPDATE public.processes SET solucionare_status = 'synced' WHERE cod_processo IS NOT NULL;
