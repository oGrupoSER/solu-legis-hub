-- Drop existing constraint and recreate with diary_status
ALTER TABLE public.partner_services DROP CONSTRAINT IF EXISTS partner_services_service_type_check;

ALTER TABLE public.partner_services ADD CONSTRAINT partner_services_service_type_check 
CHECK (service_type IN ('processes', 'distributions', 'publications', 'terms', 'diary_status'));