
-- Add unique constraints for process_dependencies
ALTER TABLE public.process_dependencies
ADD CONSTRAINT process_dependencies_cod_dependencia_cod_processo_unique 
UNIQUE (cod_dependencia, cod_processo);

-- Add unique constraint for process_groupers
ALTER TABLE public.process_groupers
ADD CONSTRAINT process_groupers_cod_agrupador_cod_processo_unique 
UNIQUE (cod_agrupador, cod_processo);

-- Add unique constraint for process_movements
ALTER TABLE public.process_movements
ADD CONSTRAINT process_movements_cod_andamento_unique 
UNIQUE (cod_andamento);

-- Add unique constraint for process_documents
ALTER TABLE public.process_documents
ADD CONSTRAINT process_documents_cod_documento_unique 
UNIQUE (cod_documento);

-- Add unique constraint for process_covers
ALTER TABLE public.process_covers
ADD CONSTRAINT process_covers_process_id_cod_agrupador_unique 
UNIQUE (process_id, cod_agrupador);
