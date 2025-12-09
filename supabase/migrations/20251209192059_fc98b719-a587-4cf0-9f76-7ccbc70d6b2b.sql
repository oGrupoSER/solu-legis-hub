-- Drop old court_news table
DROP TABLE IF EXISTS public.court_news;

-- Create new diary_status table
CREATE TABLE public.diary_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_service_id UUID REFERENCES partner_services(id) ON DELETE CASCADE,
  consulta_date DATE NOT NULL,
  cod_mapa_diario INTEGER NOT NULL,
  nome_diario TEXT,
  sigla_diario TEXT,
  esfera_diario TEXT,
  tribunal TEXT,
  estado TEXT,
  data_publicacao DATE,
  data_disponibilizacao TIMESTAMP WITH TIME ZONE,
  status TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(partner_service_id, cod_mapa_diario, consulta_date)
);

-- Enable RLS
ALTER TABLE public.diary_status ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated read access" ON public.diary_status
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.diary_status
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.diary_status
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.diary_status
  FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX idx_diary_status_partner_service ON public.diary_status(partner_service_id);
CREATE INDEX idx_diary_status_consulta_date ON public.diary_status(consulta_date);
CREATE INDEX idx_diary_status_tribunal ON public.diary_status(tribunal);
CREATE INDEX idx_diary_status_sigla ON public.diary_status(sigla_diario);