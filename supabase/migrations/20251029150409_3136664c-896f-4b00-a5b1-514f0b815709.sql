-- Add new service type for terms management
ALTER TABLE partner_services DROP CONSTRAINT IF EXISTS partner_services_service_type_check;

-- Update constraint to include new service type
ALTER TABLE partner_services 
ADD CONSTRAINT partner_services_service_type_check 
CHECK (service_type IN ('publications', 'processes', 'distributions', 'terms'));

-- Add comment for clarity
COMMENT ON COLUMN partner_services.service_type IS 'Type of service: publications (REST API), processes (SOAP), distributions (SOAP), terms (SOAP - for managing search terms/offices)';
