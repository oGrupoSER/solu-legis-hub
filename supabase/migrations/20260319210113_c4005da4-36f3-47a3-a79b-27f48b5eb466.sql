
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table to store scheduled sync job configurations
CREATE TABLE public.scheduled_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  services text[] NOT NULL DEFAULT '{}',
  cron_expression text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  pg_cron_job_id bigint,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table to store execution logs
CREATE TABLE public.scheduled_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.scheduled_sync_jobs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduled_sync_jobs
CREATE POLICY "Allow authenticated read" ON public.scheduled_sync_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON public.scheduled_sync_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.scheduled_sync_jobs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON public.scheduled_sync_jobs FOR DELETE TO authenticated USING (true);

-- RLS policies for scheduled_sync_logs (read-only for dashboard, service role inserts)
CREATE POLICY "Allow authenticated read" ON public.scheduled_sync_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow service insert" ON public.scheduled_sync_logs FOR INSERT TO public WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_sync_jobs_updated_at
  BEFORE UPDATE ON public.scheduled_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
