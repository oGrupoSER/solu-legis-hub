-- Add metadata column to search_terms for storing variations, blocking terms, scopes, OAB
ALTER TABLE public.search_terms 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.search_terms.metadata IS 'Stores variations, blocking terms, scopes (abrangencias), OAB, and cod_nome from Solucionare';