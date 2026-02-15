-- Add unique constraint for distribution deduplication
ALTER TABLE public.distributions
ADD CONSTRAINT distributions_process_number_partner_service_id_key 
UNIQUE (process_number, partner_service_id);