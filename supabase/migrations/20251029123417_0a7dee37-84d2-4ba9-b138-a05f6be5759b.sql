-- Create client_webhooks table
CREATE TABLE public.client_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_system_id UUID REFERENCES public.client_systems(id) ON DELETE CASCADE NOT NULL,
  webhook_url TEXT NOT NULL,
  events TEXT[] NOT NULL, -- ['processes', 'distributions', 'publications']
  is_active BOOLEAN DEFAULT true,
  secret TEXT, -- Para assinar payloads
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated read access"
ON public.client_webhooks
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert"
ON public.client_webhooks
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update"
ON public.client_webhooks
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete"
ON public.client_webhooks
FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_client_webhooks_updated_at
BEFORE UPDATE ON public.client_webhooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create api_requests table for logging
CREATE TABLE public.api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES public.api_tokens(id) ON DELETE CASCADE,
  client_system_id UUID REFERENCES public.client_systems(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  request_time TIMESTAMPTZ DEFAULT now(),
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow authenticated read access"
ON public.api_requests
FOR SELECT
TO authenticated
USING (true);

-- Index for performance
CREATE INDEX idx_api_requests_token_id ON public.api_requests(token_id);
CREATE INDEX idx_api_requests_client_system_id ON public.api_requests(client_system_id);
CREATE INDEX idx_api_requests_request_time ON public.api_requests(request_time);
CREATE INDEX idx_client_webhooks_client_system_id ON public.client_webhooks(client_system_id);