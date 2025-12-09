-- Remover duplicata mantendo o registro mais recente (com cod_processo maior)
DELETE FROM processes 
WHERE process_number IN (
  SELECT process_number 
  FROM processes 
  GROUP BY process_number 
  HAVING COUNT(*) > 1
)
AND id NOT IN (
  SELECT DISTINCT ON (process_number) id 
  FROM processes 
  ORDER BY process_number, cod_processo DESC NULLS LAST
);

-- Adicionar constraint unique em process_number (se ainda não existe) para evitar duplicatas futuras
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'processes_process_number_key'
  ) THEN
    ALTER TABLE public.processes ADD CONSTRAINT processes_process_number_key UNIQUE (process_number);
  END IF;
END $$;