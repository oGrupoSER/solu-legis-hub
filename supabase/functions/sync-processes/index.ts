/**
 * Sync Processes Edge Function
 * Lists registered processes from Solucionare API V3
 * Endpoint: BuscaProcessosCadastrados - returns list of codProcesso for a given office
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { RestClient } from '../_shared/rest-client.ts';
import { Logger } from '../_shared/logger.ts';
import { getActiveServices, updateLastSync, validateService } from '../_shared/service-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { serviceId, officeCode } = body;

    // Get all active process services
    let services;
    if (serviceId) {
      const { data, error } = await supabase
        .from('partner_services')
        .select('*')
        .eq('id', serviceId)
        .eq('service_type', 'processes')
        .eq('is_active', true);
      
      if (error || !data?.length) {
        throw new Error('Service not found or inactive');
      }
      services = data;
    } else {
      services = await getActiveServices('processes');
    }

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active process services found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const results = [];

    for (const service of services) {
      try {
        validateService(service);

        await logger.start({
          partner_service_id: service.id,
          sync_type: 'processes_list',
        });

        // API V3 uses query params for authentication
        const client = new RestClient({
          baseUrl: service.service_url,
          nomeRelacional: service.nome_relacional,
          token: service.token,
          authInQuery: true, // API V3 requires auth via query params
        });
        client.setLogger(logger);

        // Fetch registered processes list
        // BuscaProcessosCadastrados returns list of codProcesso for a given office
        console.log(`Fetching registered processes for service: ${service.service_name}`);
        
        const params: Record<string, any> = {};
        if (officeCode) {
          params.codEscritorio = officeCode;
        }
        
        const processesData = await client.get('/BuscaProcessosCadastrados', params);

        if (!processesData || !Array.isArray(processesData)) {
          console.log('No processes returned or invalid format:', processesData);
          await logger.success(0);
          results.push({
            service: service.service_name,
            success: true,
            recordsSynced: 0,
            message: 'No processes found',
          });
          continue;
        }

        let syncedCount = 0;

        // For each codProcesso returned, ensure it exists in our database
        for (const codProcesso of processesData) {
          // Check if process already exists
          const { data: existingProcess } = await supabase
            .from('processes')
            .select('id')
            .eq('cod_processo', codProcesso)
            .maybeSingle();

          if (!existingProcess) {
            // Create a placeholder record - full data will be synced via sync-process-updates
            const { error: insertError } = await supabase
              .from('processes')
              .insert({
                process_number: `COD-${codProcesso}`, // Temporary, will be updated when syncing cover
                cod_processo: codProcesso,
                partner_service_id: service.id,
                partner_id: service.partner_id,
                status_code: 4, // Cadastrado
                status_description: 'Cadastrado',
                raw_data: { codProcesso },
              });

            if (!insertError) {
              syncedCount++;
            }
          }
        }

        await updateLastSync(service.id);
        await logger.success(syncedCount);

        results.push({
          service: service.service_name,
          success: true,
          totalProcesses: processesData.length,
          newProcesses: syncedCount,
        });

      } catch (error) {
        console.error(`Error syncing service ${service.service_name}:`, error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await logger.error(errorMsg);

        results.push({
          service: service.service_name,
          success: false,
          error: errorMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Sync processes error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
