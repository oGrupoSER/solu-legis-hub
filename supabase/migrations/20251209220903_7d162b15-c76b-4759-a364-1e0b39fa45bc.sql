-- Remover a constraint process_number_key para permitir múltiplos cod_processo com mesmo process_number
-- (diferentes instâncias/agrupadores podem ter o mesmo número de processo)
ALTER TABLE public.processes DROP CONSTRAINT IF EXISTS processes_process_number_key;

-- Remover também a constraint composta redundante
ALTER TABLE public.processes DROP CONSTRAINT IF EXISTS processes_process_number_tribunal_key;

-- Criar uma constraint composta mais adequada: process_number + cod_processo
-- Assim cada processo com seu cod_processo é único
CREATE UNIQUE INDEX IF NOT EXISTS processes_process_number_cod_processo_idx 
ON public.processes (process_number, cod_processo) 
WHERE cod_processo IS NOT NULL;

-- Manter o índice simples de process_number para buscas
CREATE INDEX IF NOT EXISTS idx_processes_process_number ON public.processes (process_number);