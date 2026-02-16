
-- 1. Create api_delivery_cursors table
CREATE TABLE public.api_delivery_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_system_id uuid NOT NULL REFERENCES public.client_systems(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  last_delivered_id uuid,
  last_delivered_at timestamptz,
  batch_size integer NOT NULL DEFAULT 500,
  pending_confirmation boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  total_delivered integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_system_id, service_type)
);

ALTER TABLE public.api_delivery_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.api_delivery_cursors FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert" ON public.api_delivery_cursors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.api_delivery_cursors FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete" ON public.api_delivery_cursors FOR DELETE USING (true);

CREATE TRIGGER update_api_delivery_cursors_updated_at
  BEFORE UPDATE ON public.api_delivery_cursors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create api_ip_rules table
CREATE TABLE public.api_ip_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  rule_type text NOT NULL DEFAULT 'block',
  reason text,
  client_system_id uuid REFERENCES public.client_systems(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_ip_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.api_ip_rules FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert" ON public.api_ip_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.api_ip_rules FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete" ON public.api_ip_rules FOR DELETE USING (true);

CREATE TRIGGER update_api_ip_rules_updated_at
  BEFORE UPDATE ON public.api_ip_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create api_security_logs table
CREATE TABLE public.api_security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text,
  token_id uuid REFERENCES public.api_tokens(id) ON DELETE SET NULL,
  client_system_id uuid REFERENCES public.client_systems(id) ON DELETE SET NULL,
  endpoint text,
  block_reason text NOT NULL,
  request_method text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON public.api_security_logs FOR SELECT USING (true);
CREATE POLICY "Allow service role insert" ON public.api_security_logs FOR INSERT WITH CHECK (true);

-- 4. Alter api_tokens: add security columns
ALTER TABLE public.api_tokens
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS rate_limit_override integer,
  ADD COLUMN IF NOT EXISTS allowed_ips text[];
