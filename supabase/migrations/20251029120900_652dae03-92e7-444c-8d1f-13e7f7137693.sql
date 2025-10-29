-- Create partner_services table for managing partner-specific services
CREATE TABLE public.partner_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('processes', 'distributions', 'publications')),
  service_url TEXT NOT NULL,
  nome_relacional TEXT NOT NULL,
  token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  UNIQUE(partner_id, service_type)
);

-- Create index for performance
CREATE INDEX idx_partner_services_partner_id ON public.partner_services(partner_id);
CREATE INDEX idx_partner_services_service_type ON public.partner_services(service_type);
CREATE INDEX idx_partner_services_active ON public.partner_services(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.partner_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated read access" 
ON public.partner_services 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated insert" 
ON public.partner_services 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow authenticated update" 
ON public.partner_services 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow authenticated delete" 
ON public.partner_services 
FOR DELETE 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_partner_services_updated_at
BEFORE UPDATE ON public.partner_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add partner_service_id to existing tables
ALTER TABLE public.processes ADD COLUMN partner_service_id UUID REFERENCES public.partner_services(id);
ALTER TABLE public.distributions ADD COLUMN partner_service_id UUID REFERENCES public.partner_services(id);
ALTER TABLE public.publications ADD COLUMN partner_service_id UUID REFERENCES public.partner_services(id);
ALTER TABLE public.search_terms ADD COLUMN partner_service_id UUID REFERENCES public.partner_services(id);
ALTER TABLE public.sync_logs ADD COLUMN partner_service_id UUID REFERENCES public.partner_services(id);

-- Create indexes for the new foreign keys
CREATE INDEX idx_processes_partner_service_id ON public.processes(partner_service_id);
CREATE INDEX idx_distributions_partner_service_id ON public.distributions(partner_service_id);
CREATE INDEX idx_publications_partner_service_id ON public.publications(partner_service_id);
CREATE INDEX idx_search_terms_partner_service_id ON public.search_terms(partner_service_id);
CREATE INDEX idx_sync_logs_partner_service_id ON public.sync_logs(partner_service_id);