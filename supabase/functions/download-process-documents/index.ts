/**
 * Download Process Documents Edge Function
 * Downloads documents from Solucionare external URLs and stores them in Supabase Storage.
 * Updates process_documents.storage_path with the storage path.
 * 
 * Can be called:
 * - After sync to process newly synced documents
 * - Manually to retry failed downloads
 * - With a specific document ID to download a single document
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BUCKET_NAME = 'process-documents';
const BATCH_SIZE = 20; // Process 20 documents per invocation to avoid timeouts

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { documentId, processId, limit = BATCH_SIZE } = body;

    let query = supabase
      .from('process_documents')
      .select('id, cod_documento, cod_processo, documento_url, nome_arquivo, tipo_documento')
      .not('documento_url', 'is', null)
      .is('storage_path', null); // Only documents not yet downloaded

    if (documentId) {
      query = query.eq('id', documentId);
    } else if (processId) {
      // Download all documents for a specific process
      const { data: process } = await supabase
        .from('processes')
        .select('cod_processo')
        .eq('id', processId)
        .single();
      
      if (process?.cod_processo) {
        query = query.eq('cod_processo', process.cod_processo);
      }
    }

    const { data: documents, error: fetchError } = await query
      .order('created_at', { ascending: true })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch documents: ${fetchError.message}`);
    }

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No documents to download', downloaded: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${documents.length} documents to download`);

    let downloaded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        const result = await downloadAndStore(supabase, doc);
        if (result) {
          downloaded++;
        } else {
          failed++;
          errors.push(`Doc ${doc.cod_documento}: download returned empty`);
        }
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Doc ${doc.cod_documento}: ${msg}`);
        console.error(`Failed to download doc ${doc.cod_documento}:`, msg);
      }
    }

    console.log(`Download complete: ${downloaded} downloaded, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        downloaded, 
        failed, 
        total: documents.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Download process documents error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function downloadAndStore(supabase: any, doc: any): Promise<boolean> {
  const { id, cod_documento, cod_processo, documento_url, nome_arquivo } = doc;

  if (!documento_url) return false;

  console.log(`Downloading doc ${cod_documento} from ${documento_url}`);

  // Download the file from the external URL
  const response = await fetch(documento_url, {
    headers: {
      'User-Agent': 'Lovable-DocSync/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const fileData = await response.arrayBuffer();
  
  // Check if the response is an error page (e.g., "Arquivo invalido!")
  if (contentType.includes('text/html') && fileData.byteLength < 1000) {
    const text = new TextDecoder().decode(fileData);
    if (text.includes('Arquivo invalido') || text.includes('invalido')) {
      throw new Error('Source returned "Arquivo invalido!" - file may have expired');
    }
  }

  if (fileData.byteLength === 0) {
    throw new Error('Downloaded file is empty');
  }

  // Determine file extension from URL or content type
  const extension = getFileExtension(documento_url, contentType, nome_arquivo);
  
  // Storage path: {cod_processo}/{cod_documento}.{ext}
  const storagePath = `${cod_processo}/${cod_documento}${extension}`;

  console.log(`Uploading to storage: ${storagePath} (${fileData.byteLength} bytes, ${contentType})`);

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileData, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  const publicUrl = urlData?.publicUrl;

  // Update the document record with storage path and new URL
  const { error: updateError } = await supabase
    .from('process_documents')
    .update({
      storage_path: storagePath,
      documento_url: publicUrl || storagePath,
    })
    .eq('id', id);

  if (updateError) {
    throw new Error(`DB update failed: ${updateError.message}`);
  }

  console.log(`Successfully stored doc ${cod_documento} at ${storagePath}`);
  return true;
}

function getFileExtension(url: string, contentType: string, nome_arquivo: string | null): string {
  // Try from nome_arquivo first
  if (nome_arquivo) {
    const match = nome_arquivo.match(/\.[a-zA-Z0-9]+$/);
    if (match) return match[0];
  }

  // Try from URL path AND query parameters (Solucionare uses ?c=path/file.pdf)
  try {
    const urlObj = new URL(url);
    // Check pathname
    const pathMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (pathMatch) return `.${pathMatch[1]}`;
    // Check query string for file extensions (e.g., ?c=R/TJMG_PJE/09/.../file.pdf)
    const fullUrl = urlObj.toString();
    const queryExtMatch = fullUrl.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$|&)/);
    if (queryExtMatch) return `.${queryExtMatch[1]}`;
    // Check the 'c' parameter specifically
    const cParam = urlObj.searchParams.get('c');
    if (cParam) {
      const cMatch = cParam.match(/\.([a-zA-Z0-9]{2,5})$/);
      if (cMatch) return `.${cMatch[1]}`;
    }
  } catch {}

  // Fallback to content type
  const typeMap: Record<string, string> = {
    'application/pdf': '.pdf',
    'text/html': '.html',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };

  for (const [type, ext] of Object.entries(typeMap)) {
    if (contentType.includes(type)) return ext;
  }

  return '.bin';
}
