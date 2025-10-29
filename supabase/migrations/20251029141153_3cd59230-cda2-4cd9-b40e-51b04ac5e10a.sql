-- Add cod_publicacao column to publications table
ALTER TABLE publications 
ADD COLUMN IF NOT EXISTS cod_publicacao INTEGER;

-- Create unique index on cod_publicacao to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_cod_publicacao 
ON publications(cod_publicacao);