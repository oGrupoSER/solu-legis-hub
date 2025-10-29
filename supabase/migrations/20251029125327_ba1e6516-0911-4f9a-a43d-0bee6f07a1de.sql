-- Enable realtime for sync_logs and api_requests tables
ALTER TABLE public.sync_logs REPLICA IDENTITY FULL;
ALTER TABLE public.api_requests REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_requests;