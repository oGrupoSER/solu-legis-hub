-- Add office_code column to client_systems table
ALTER TABLE public.client_systems 
ADD COLUMN office_code INTEGER;

-- Add comment to explain the column
COMMENT ON COLUMN public.client_systems.office_code IS 'Código do escritório usado nas chamadas SOAP';