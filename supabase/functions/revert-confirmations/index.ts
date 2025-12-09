import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RevertRequest {
  type: 'publications' | 'processes' | 'documents' | 'distributions';
  partner_service_id: string;
  codes: number[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, partner_service_id, codes } = await req.json() as RevertRequest;

    console.log(`[revert-confirmations] Starting reversal for ${type}, ${codes.length} items`);

    // Get service configuration
    const { data: service, error: serviceError } = await supabase
      .from('partner_services')
      .select('*')
      .eq('id', partner_service_id)
      .single();

    if (serviceError || !service) {
      throw new Error(`Service not found: ${partner_service_id}`);
    }

    const { service_url, nome_relacional, token } = service;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Build base URL with authentication
    const baseUrl = service_url.includes('?') 
      ? `${service_url}&nomeRelacional=${encodeURIComponent(nome_relacional)}&token=${encodeURIComponent(token)}`
      : `${service_url}?nomeRelacional=${encodeURIComponent(nome_relacional)}&token=${encodeURIComponent(token)}`;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      
      try {
        let endpoint = '';
        let payload: any = {};

        switch (type) {
          case 'publications':
            // API endpoint for reverting publication confirmations
            endpoint = baseUrl.replace('/getPublicacoes', '/ReverterConfirmacaoPublicacao')
              .replace('/Publicacoes', '/ReverterConfirmacaoPublicacao');
            payload = batch.map(code => ({ codPublicacao: code }));
            break;

          case 'processes':
            // API endpoint for reverting process confirmations
            // The exact endpoint depends on the Solucionare API specification
            endpoint = baseUrl.replace('BuscaProcessosCadastrados', 'ReverterConfirmacaoProcesso')
              .replace('/AndamentoProcessual', '/AndamentoProcessual/ReverterConfirmacao');
            payload = batch.map(code => ({ codProcesso: code }));
            break;

          case 'documents':
            // API endpoint for reverting document confirmations
            endpoint = baseUrl.replace('BuscaProcessosCadastrados', 'ReverterConfirmacaoDocumento')
              .replace('/AndamentoProcessual', '/AndamentoProcessual/ReverterConfirmacaoDocumento');
            payload = batch.map(code => ({ codDocumento: code }));
            break;

          case 'distributions':
            endpoint = baseUrl.replace('/getDistribuicoes', '/ReverterConfirmacaoDistribuicao');
            payload = batch.map(code => ({ codDistribuicao: code }));
            break;
        }

        console.log(`[revert-confirmations] Calling ${endpoint} with ${batch.length} items`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`[revert-confirmations] Batch result:`, result);
          
          // Check response structure for success/failure counts
          if (result.sucesso !== undefined) {
            success += result.sucesso || batch.length;
            failed += result.falha || 0;
          } else {
            success += batch.length;
          }
        } else {
          const errorText = await response.text();
          console.error(`[revert-confirmations] API error: ${response.status} - ${errorText}`);
          errors.push(`Batch ${i}-${i + batch.length}: HTTP ${response.status}`);
          failed += batch.length;
        }
      } catch (batchError) {
        console.error(`[revert-confirmations] Batch error:`, batchError);
        errors.push(`Batch ${i}-${i + batch.length}: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
        failed += batch.length;
      }
    }

    console.log(`[revert-confirmations] Completed: ${success} success, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success, 
        failed, 
        errors,
        message: `Reversão concluída: ${success} sucesso, ${failed} falhas`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[revert-confirmations] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
