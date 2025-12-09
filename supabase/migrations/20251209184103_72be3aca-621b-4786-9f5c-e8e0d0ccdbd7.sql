-- Create client_system_services table to link clients with specific services
CREATE TABLE public.client_system_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_system_id UUID NOT NULL REFERENCES public.client_systems(id) ON DELETE CASCADE,
  partner_service_id UUID NOT NULL REFERENCES public.partner_services(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_system_id, partner_service_id)
);

-- Enable RLS
ALTER TABLE public.client_system_services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated read access" ON public.client_system_services
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.client_system_services
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.client_system_services
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.client_system_services
  FOR DELETE USING (true);

-- Create indexes for performance
CREATE INDEX idx_client_system_services_client ON public.client_system_services(client_system_id);
CREATE INDEX idx_client_system_services_service ON public.client_system_services(partner_service_id);

-- Add trigger for updated_at
CREATE TRIGGER update_client_system_services_updated_at
  BEFORE UPDATE ON public.client_system_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Also add court_news to service_type check constraint
ALTER TABLE public.partner_services DROP CONSTRAINT IF EXISTS partner_services_service_type_check;
ALTER TABLE public.partner_services ADD CONSTRAINT partner_services_service_type_check 
  CHECK (service_type IN ('processes', 'distributions', 'publications', 'terms', 'court_news'));