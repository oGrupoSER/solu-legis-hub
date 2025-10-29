-- Add office_code column to partner_services table
ALTER TABLE public.partner_services 
ADD COLUMN office_code INTEGER;

-- Add comment to explain the column
COMMENT ON COLUMN public.partner_services.office_code IS 'Código do escritório usado nas chamadas SOAP para o Solucionare';