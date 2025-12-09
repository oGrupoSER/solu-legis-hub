
-- =====================================================
-- FASE 1: Reestruturação do Banco de Dados
-- Integração completa com Solucionare API V3
-- =====================================================

-- 1. Alterações na tabela processes
ALTER TABLE public.processes 
ADD COLUMN IF NOT EXISTS cod_processo integer,
ADD COLUMN IF NOT EXISTS cod_escritorio integer,
ADD COLUMN IF NOT EXISTS status_code integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS status_description text,
ADD COLUMN IF NOT EXISTS uf varchar(2);

-- Índice para busca por cod_processo (ID Solucionare)
CREATE INDEX IF NOT EXISTS idx_processes_cod_processo ON public.processes(cod_processo);
CREATE INDEX IF NOT EXISTS idx_processes_cod_escritorio ON public.processes(cod_escritorio);
CREATE INDEX IF NOT EXISTS idx_processes_status_code ON public.processes(status_code);

-- Comentários explicativos
COMMENT ON COLUMN public.processes.cod_processo IS 'ID do processo na Solucionare';
COMMENT ON COLUMN public.processes.cod_escritorio IS 'Código do escritório na Solucionare';
COMMENT ON COLUMN public.processes.status_code IS 'Status: 2-Validando, 4-Cadastrado, 5-Arquivado, 6-Segredo, 7-Erro';
COMMENT ON COLUMN public.processes.status_description IS 'Descrição do status do processo';
COMMENT ON COLUMN public.processes.uf IS 'UF do tribunal do processo';

-- 2. Alterações na tabela process_movements
ALTER TABLE public.process_movements 
ADD COLUMN IF NOT EXISTS cod_andamento integer,
ADD COLUMN IF NOT EXISTS cod_agrupador integer,
ADD COLUMN IF NOT EXISTS data_andamento timestamp with time zone,
ADD COLUMN IF NOT EXISTS tipo_andamento text;

CREATE INDEX IF NOT EXISTS idx_process_movements_cod_andamento ON public.process_movements(cod_andamento);
CREATE INDEX IF NOT EXISTS idx_process_movements_cod_agrupador ON public.process_movements(cod_agrupador);

COMMENT ON COLUMN public.process_movements.cod_andamento IS 'ID do andamento na Solucionare';
COMMENT ON COLUMN public.process_movements.cod_agrupador IS 'ID do agrupador (instância) na Solucionare';

-- 3. Tabela process_groupers (Agrupadores/Instâncias)
CREATE TABLE IF NOT EXISTS public.process_groupers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid REFERENCES public.processes(id) ON DELETE CASCADE,
  cod_agrupador integer NOT NULL,
  cod_processo integer NOT NULL,
  posicao integer,
  titulo text,
  num_processo text,
  instancia integer,
  tribunal text,
  comarca text,
  vara text,
  data_cadastro timestamp with time zone,
  is_confirmed boolean DEFAULT false,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(cod_agrupador)
);

CREATE INDEX IF NOT EXISTS idx_process_groupers_process_id ON public.process_groupers(process_id);
CREATE INDEX IF NOT EXISTS idx_process_groupers_cod_processo ON public.process_groupers(cod_processo);

ALTER TABLE public.process_groupers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.process_groupers
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.process_groupers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.process_groupers
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.process_groupers
  FOR DELETE USING (true);

-- 4. Tabela process_dependencies (Dependências entre processos)
CREATE TABLE IF NOT EXISTS public.process_dependencies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid REFERENCES public.processes(id) ON DELETE CASCADE,
  cod_dependencia integer NOT NULL,
  cod_processo integer NOT NULL,
  num_processo text,
  instancia integer,
  titulo text,
  is_confirmed boolean DEFAULT false,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(cod_dependencia)
);

CREATE INDEX IF NOT EXISTS idx_process_dependencies_process_id ON public.process_dependencies(process_id);
CREATE INDEX IF NOT EXISTS idx_process_dependencies_cod_processo ON public.process_dependencies(cod_processo);

ALTER TABLE public.process_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.process_dependencies
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.process_dependencies
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.process_dependencies
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.process_dependencies
  FOR DELETE USING (true);

-- 5. Tabela process_documents (Documentos de processos e andamentos)
CREATE TABLE IF NOT EXISTS public.process_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid REFERENCES public.processes(id) ON DELETE CASCADE,
  movement_id uuid REFERENCES public.process_movements(id) ON DELETE SET NULL,
  cod_documento integer NOT NULL,
  cod_processo integer,
  cod_andamento integer,
  cod_agrupador integer,
  documento_url text,
  tipo_documento text,
  nome_arquivo text,
  tamanho_bytes integer,
  is_confirmed boolean DEFAULT false,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(cod_documento)
);

CREATE INDEX IF NOT EXISTS idx_process_documents_process_id ON public.process_documents(process_id);
CREATE INDEX IF NOT EXISTS idx_process_documents_movement_id ON public.process_documents(movement_id);
CREATE INDEX IF NOT EXISTS idx_process_documents_cod_andamento ON public.process_documents(cod_andamento);

ALTER TABLE public.process_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.process_documents
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.process_documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.process_documents
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.process_documents
  FOR DELETE USING (true);

-- 6. Tabela process_covers (Capa do processo)
CREATE TABLE IF NOT EXISTS public.process_covers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid REFERENCES public.processes(id) ON DELETE CASCADE,
  grouper_id uuid REFERENCES public.process_groupers(id) ON DELETE CASCADE,
  cod_agrupador integer,
  cod_processo integer,
  comarca text,
  vara text,
  tribunal text,
  assunto text,
  natureza text,
  tipo_acao text,
  classe text,
  juiz text,
  valor_causa decimal(15,2),
  data_distribuicao timestamp with time zone,
  data_atualizacao timestamp with time zone,
  situacao text,
  area text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(cod_agrupador)
);

CREATE INDEX IF NOT EXISTS idx_process_covers_process_id ON public.process_covers(process_id);
CREATE INDEX IF NOT EXISTS idx_process_covers_grouper_id ON public.process_covers(grouper_id);

ALTER TABLE public.process_covers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.process_covers
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.process_covers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.process_covers
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.process_covers
  FOR DELETE USING (true);

-- 7. Tabela process_parties (Partes do processo - Autores/Réus)
CREATE TABLE IF NOT EXISTS public.process_parties (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid REFERENCES public.processes(id) ON DELETE CASCADE,
  cover_id uuid REFERENCES public.process_covers(id) ON DELETE CASCADE,
  cod_processo_polo integer,
  cod_agrupador integer,
  tipo_polo integer NOT NULL, -- 1-Ativo (Autor), 2-Passivo (Réu)
  nome text NOT NULL,
  cpf text,
  cnpj text,
  tipo_pessoa text, -- PF ou PJ
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(cod_processo_polo, cod_agrupador)
);

CREATE INDEX IF NOT EXISTS idx_process_parties_process_id ON public.process_parties(process_id);
CREATE INDEX IF NOT EXISTS idx_process_parties_cover_id ON public.process_parties(cover_id);
CREATE INDEX IF NOT EXISTS idx_process_parties_tipo_polo ON public.process_parties(tipo_polo);

ALTER TABLE public.process_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.process_parties
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.process_parties
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.process_parties
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.process_parties
  FOR DELETE USING (true);

COMMENT ON COLUMN public.process_parties.tipo_polo IS '1-Polo Ativo (Autor), 2-Polo Passivo (Réu)';

-- 8. Tabela process_lawyers (Advogados vinculados às partes)
CREATE TABLE IF NOT EXISTS public.process_lawyers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid REFERENCES public.processes(id) ON DELETE CASCADE,
  party_id uuid REFERENCES public.process_parties(id) ON DELETE CASCADE,
  cod_processo_polo integer,
  cod_agrupador integer,
  nome_advogado text NOT NULL,
  num_oab text,
  uf_oab varchar(2),
  tipo_oab text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_process_lawyers_process_id ON public.process_lawyers(process_id);
CREATE INDEX IF NOT EXISTS idx_process_lawyers_party_id ON public.process_lawyers(party_id);
CREATE INDEX IF NOT EXISTS idx_process_lawyers_num_oab ON public.process_lawyers(num_oab);

ALTER TABLE public.process_lawyers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.process_lawyers
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.process_lawyers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.process_lawyers
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.process_lawyers
  FOR DELETE USING (true);

-- 9. Tabela court_news (Notícias de status dos tribunais)
CREATE TABLE IF NOT EXISTS public.court_news (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_service_id uuid REFERENCES public.partner_services(id) ON DELETE SET NULL,
  cod_noticia integer NOT NULL,
  cod_mapa_diario integer,
  tribunal text,
  estado text,
  sigla_diario text,
  cod_assunto integer,
  assunto text,
  titulo text,
  descricao text,
  data_publicacao timestamp with time zone,
  data_disponibilizacao timestamp with time zone,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(cod_noticia)
);

CREATE INDEX IF NOT EXISTS idx_court_news_partner_service_id ON public.court_news(partner_service_id);
CREATE INDEX IF NOT EXISTS idx_court_news_tribunal ON public.court_news(tribunal);
CREATE INDEX IF NOT EXISTS idx_court_news_data_publicacao ON public.court_news(data_publicacao);
CREATE INDEX IF NOT EXISTS idx_court_news_cod_assunto ON public.court_news(cod_assunto);

ALTER TABLE public.court_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.court_news
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON public.court_news
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.court_news
  FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated delete" ON public.court_news
  FOR DELETE USING (true);

-- 10. Triggers para updated_at nas novas tabelas
CREATE TRIGGER update_process_groupers_updated_at
  BEFORE UPDATE ON public.process_groupers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_covers_updated_at
  BEFORE UPDATE ON public.process_covers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Adicionar coluna last_cover_sync em processes para controle
ALTER TABLE public.processes 
ADD COLUMN IF NOT EXISTS last_cover_sync_at timestamp with time zone;

COMMENT ON COLUMN public.processes.last_cover_sync_at IS 'Última sincronização de capa do processo';
