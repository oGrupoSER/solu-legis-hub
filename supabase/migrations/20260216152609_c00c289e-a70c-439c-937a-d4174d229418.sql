
-- Add storage_path column to track files stored locally
ALTER TABLE public.process_documents ADD COLUMN IF NOT EXISTS storage_path text;

-- Create storage bucket for process documents
INSERT INTO storage.buckets (id, name, public) VALUES ('process-documents', 'process-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for process documents
CREATE POLICY "Process documents are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'process-documents');

-- Service role can upload documents
CREATE POLICY "Service role can upload process documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'process-documents');

-- Service role can update process documents
CREATE POLICY "Service role can update process documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'process-documents');

-- Service role can delete process documents
CREATE POLICY "Service role can delete process documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'process-documents');
