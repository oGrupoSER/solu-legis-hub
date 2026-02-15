
-- 1. Adicionar office_code ao parceiro
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS office_code integer;

-- 2. Tabela de vínculo cliente <-> termos de busca
CREATE TABLE public.client_search_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_system_id uuid NOT NULL REFERENCES public.client_systems(id) ON DELETE CASCADE,
  search_term_id uuid NOT NULL REFERENCES public.search_terms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_system_id, search_term_id)
);

ALTER TABLE public.client_search_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.client_search_terms FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert" ON public.client_search_terms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.client_search_terms FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete" ON public.client_search_terms FOR DELETE USING (true);

CREATE INDEX idx_client_search_terms_client ON public.client_search_terms(client_system_id);
CREATE INDEX idx_client_search_terms_term ON public.client_search_terms(search_term_id);

-- 3. Tabela de vínculo cliente <-> processos
CREATE TABLE public.client_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_system_id uuid NOT NULL REFERENCES public.client_systems(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_system_id, process_id)
);

ALTER TABLE public.client_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.client_processes FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert" ON public.client_processes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.client_processes FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete" ON public.client_processes FOR DELETE USING (true);

CREATE INDEX idx_client_processes_client ON public.client_processes(client_system_id);
CREATE INDEX idx_client_processes_process ON public.client_processes(process_id);

-- 4. Adicionar solucionare_code ao search_terms
ALTER TABLE public.search_terms ADD COLUMN IF NOT EXISTS solucionare_code integer;
