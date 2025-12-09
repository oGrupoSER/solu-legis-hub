-- Remove duplicate processes keeping the oldest one
DELETE FROM processes a USING processes b
WHERE a.id > b.id 
  AND a.cod_processo = b.cod_processo 
  AND a.cod_processo IS NOT NULL;

-- Add unique constraint on cod_processo
ALTER TABLE public.processes ADD CONSTRAINT processes_cod_processo_unique UNIQUE (cod_processo);