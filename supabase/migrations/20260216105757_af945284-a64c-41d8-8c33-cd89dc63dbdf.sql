
-- Table to store API call logs (request/response metadata, not data payloads)
CREATE TABLE public.api_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_log_id UUID REFERENCES public.sync_logs(id) ON DELETE SET NULL,
  partner_service_id UUID REFERENCES public.partner_services(id) ON DELETE SET NULL,
  call_type TEXT NOT NULL DEFAULT 'REST', -- REST, SOAP
  method TEXT NOT NULL, -- GET, POST, PUT, DELETE, SOAP
  url TEXT NOT NULL,
  request_headers JSONB,
  request_body TEXT, -- JSON or XML body (truncated if large)
  response_status INTEGER,
  response_status_text TEXT,
  response_headers JSONB,
  response_summary TEXT, -- Short summary: record count, error message, etc.
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster queries
CREATE INDEX idx_api_call_logs_sync_log ON public.api_call_logs(sync_log_id);
CREATE INDEX idx_api_call_logs_created ON public.api_call_logs(created_at DESC);
CREATE INDEX idx_api_call_logs_partner_service ON public.api_call_logs(partner_service_id);

-- Enable RLS
ALTER TABLE public.api_call_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view api_call_logs"
ON public.api_call_logs FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow service role to insert (edge functions)
CREATE POLICY "Service role can insert api_call_logs"
ON public.api_call_logs FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_call_logs;
