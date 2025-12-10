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

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      
      try {
        let endpoint = '';

        switch (type) {
          case 'publications':
            // Use the same confirmation endpoint with confirmar=false to revert
            // POST api/ControllerApi/Publicacoes/confirmaRecebimentoPublicacao?nomeRelacional={nomeRelacional}&token={token}&confirmar={confirmar}
            // Body: Collection of integer (cod_publicacao)
            const basePublicationsUrl = service_url.replace('/getPublicacoes', '').replace('/Publicacoes', '');
            endpoint = `${basePublicationsUrl}/Publicacoes/confirmaRecebimentoPublicacao?nomeRelacional=${encodeURIComponent(nome_relacional)}&token=${encodeURIComponent(token)}&confirmar=false`;
            break;

          case 'processes':
            // Use ConfirmaRecebimentoAgrupador endpoint with confirmar=false
            // Processes are confirmed via their groupers (cod_agrupador)
            const baseProcessUrl = service_url.replace('/BuscaProcessosCadastrados', '');
            endpoint = `${baseProcessUrl}/ConfirmaRecebimentoAgrupador?nomeRelacional=${encodeURIComponent(nome_relacional)}&token=${encodeURIComponent(token)}&confirmar=false`;
            break;

          case 'documents':
            // Use ConfirmaRecebimentoDocumento endpoint with confirmar=false
            const baseDocUrl = service_url.replace('/BuscaProcessosCadastrados', '');
            endpoint = `${baseDocUrl}/ConfirmaRecebimentoDocumento?nomeRelacional=${encodeURIComponent(nome_relacional)}&token=${encodeURIComponent(token)}&confirmar=false`;
            break;

          case 'distributions':
            const baseDistUrl = service_url.replace('/getDistribuicoes', '').replace('/Distribuicoes', '');
            endpoint = `${baseDistUrl}/Distribuicoes/confirmaRecebimentoDistribuicao?nomeRelacional=${encodeURIComponent(nome_relacional)}&token=${encodeURIComponent(token)}&confirmar=false`;
            break;
        }

        console.log(`[revert-confirmations] Calling ${endpoint} with ${batch.length} items`);
        console.log(`[revert-confirmations] Payload: ${JSON.stringify(batch)}`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch), // Send array of integers directly
        });

        const responseText = await response.text();
        console.log(`[revert-confirmations] Response status: ${response.status}, body: ${responseText}`);

        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            console.log(`[revert-confirmations] Batch result:`, result);
            
            // Check response structure for success/failure counts
            if (result.sucesso !== undefined) {
              success += result.sucesso || batch.length;
              failed += result.falha || 0;
            } else {
              success += batch.length;
            }
          } catch {
            // Response might not be JSON
            success += batch.length;
          }
        } else {
          console.error(`[revert-confirmations] API error: ${response.status} - ${responseText}`);
          errors.push(`Batch ${i}-${i + batch.length}: HTTP ${response.status} - ${responseText}`);
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
