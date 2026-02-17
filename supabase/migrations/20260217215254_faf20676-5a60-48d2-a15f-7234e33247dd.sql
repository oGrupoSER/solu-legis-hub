
-- Create record_confirmations table
CREATE TABLE public.record_confirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id uuid NOT NULL,
  record_type text NOT NULL,
  client_system_id uuid NOT NULL REFERENCES public.client_systems(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index to prevent duplicates
CREATE UNIQUE INDEX idx_record_confirmations_unique 
  ON public.record_confirmations (record_id, record_type, client_system_id);

-- Index for fast lookups by record_type
CREATE INDEX idx_record_confirmations_type 
  ON public.record_confirmations (record_type);

-- Index for fast lookups by record_id
CREATE INDEX idx_record_confirmations_record 
  ON public.record_confirmations (record_id);

-- Enable RLS
ALTER TABLE public.record_confirmations ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Allow authenticated read access"
  ON public.record_confirmations
  FOR SELECT
  USING (true);

-- Service role can insert (edge functions)
CREATE POLICY "Allow service role insert"
  ON public.record_confirmations
  FOR INSERT
  WITH CHECK (true);
