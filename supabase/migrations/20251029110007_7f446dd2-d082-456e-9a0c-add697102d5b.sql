-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create partners table (Solucionare and future partners)
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  api_base_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create client_systems table (systems that will consume our API)
CREATE TABLE public.client_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  contact_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create api_tokens table (authentication tokens for client systems)
CREATE TABLE public.api_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_system_id UUID REFERENCES public.client_systems(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create processes table (from API V3 Andamentos)
CREATE TABLE public.processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES public.partners(id),
  process_number TEXT NOT NULL,
  tribunal TEXT,
  instance TEXT,
  status TEXT,
  raw_data JSONB NOT NULL,
  last_sync_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(process_number, tribunal)
);

-- Create process_movements table (andamentos)
CREATE TABLE public.process_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  process_id UUID REFERENCES public.processes(id) ON DELETE CASCADE,
  movement_date TIMESTAMPTZ,
  movement_type TEXT,
  description TEXT,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create distributions table (from WebAPI Distribuições)
CREATE TABLE public.distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES public.partners(id),
  process_number TEXT NOT NULL,
  distribution_date TIMESTAMPTZ,
  tribunal TEXT,
  term TEXT,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create search_terms table (for publications and distributions)
CREATE TABLE public.search_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES public.partners(id),
  term TEXT NOT NULL,
  term_type TEXT NOT NULL, -- 'publication' or 'distribution'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create publications table (from WebService Publicações)
CREATE TABLE public.publications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES public.partners(id),
  publication_date DATE,
  gazette_name TEXT,
  content TEXT,
  matched_terms TEXT[],
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sync_logs table (track API synchronization)
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID REFERENCES public.partners(id),
  sync_type TEXT NOT NULL, -- 'processes', 'distributions', 'publications'
  status TEXT NOT NULL, -- 'success', 'error', 'in_progress'
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (admin full access for now - will refine with role system)
CREATE POLICY "Allow authenticated read access" ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON public.partners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.partners FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON public.partners FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON public.client_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON public.client_systems FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.client_systems FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON public.client_systems FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON public.api_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON public.api_tokens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.api_tokens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON public.api_tokens FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON public.processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.process_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.distributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.search_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON public.search_terms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.search_terms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON public.search_terms FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.publications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.sync_logs FOR SELECT TO authenticated USING (true);

-- Create indexes for performance
CREATE INDEX idx_processes_number ON public.processes(process_number);
CREATE INDEX idx_processes_tribunal ON public.processes(tribunal);
CREATE INDEX idx_distributions_date ON public.distributions(distribution_date);
CREATE INDEX idx_publications_date ON public.publications(publication_date);
CREATE INDEX idx_api_tokens_token ON public.api_tokens(token);
CREATE INDEX idx_sync_logs_partner ON public.sync_logs(partner_id, sync_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_systems_updated_at BEFORE UPDATE ON public.client_systems
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_processes_updated_at BEFORE UPDATE ON public.processes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_search_terms_updated_at BEFORE UPDATE ON public.search_terms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();