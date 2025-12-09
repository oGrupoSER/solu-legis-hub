-- Remover coluna office_code da tabela partner_services
ALTER TABLE public.partner_services DROP COLUMN IF EXISTS office_code;