
ALTER TABLE public.process_covers ADD COLUMN IF NOT EXISTS digital boolean;
ALTER TABLE public.process_covers ADD COLUMN IF NOT EXISTS link_consulta_processo text;
ALTER TABLE public.process_covers ADD COLUMN IF NOT EXISTS sigla_sistema text;
ALTER TABLE public.process_covers ADD COLUMN IF NOT EXISTS nome_sistema text;
ALTER TABLE public.process_covers ADD COLUMN IF NOT EXISTS cod_sistema integer;
