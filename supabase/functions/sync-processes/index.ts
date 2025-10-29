/**
 * Sync Processes Edge Function
 * Syncs process movements from Solucionare API V3
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
    // Get all active process services
    const services = await getActiveServices('processes');

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
          sync_type: 'processes',
        });

        const client = new RestClient({
          baseUrl: service.service_url,
          nomeRelacional: service.nome_relacional,
          token: service.token,
        });

        // Fetch processes list
        console.log(`Fetching processes for service: ${service.service_name}`);
        const processesData = await client.get('/BuscaProcessos');

        if (!processesData || !Array.isArray(processesData)) {
          throw new Error('Invalid response format from BuscaProcessos');
        }

        let syncedCount = 0;

        // For each process, fetch new movements
        for (const process of processesData) {
          const { numeroProcesso, tribunal } = process;

          // Fetch new movements since last sync
          const movementsData = await client.get('/BuscaNovosAndamentos', {
            numeroProcesso,
            dataUltimaConsulta: service.last_sync_at || new Date(0).toISOString(),
          });

          // Upsert process
          const { data: processRecord, error: processError } = await supabase
            .from('processes')
            .upsert({
              process_number: numeroProcesso,
              tribunal: tribunal,
              partner_service_id: service.id,
              partner_id: service.partner_id,
              raw_data: process,
              status: process.status || null,
              instance: process.instancia || null,
            }, {
              onConflict: 'process_number',
              ignoreDuplicates: false,
            })
            .select('id')
            .single();

          if (processError) {
            console.error(`Error upserting process ${numeroProcesso}:`, processError);
            continue;
          }

          // Insert movements
          if (Array.isArray(movementsData) && movementsData.length > 0) {
            const movements = movementsData.map((movement: any) => ({
              process_id: processRecord.id,
              movement_type: movement.tipo || null,
              movement_date: movement.data || null,
              description: movement.descricao || null,
              raw_data: movement,
            }));

            const { error: movementsError } = await supabase
              .from('process_movements')
              .insert(movements);

            if (movementsError) {
              console.error(`Error inserting movements for ${numeroProcesso}:`, movementsError);
            } else {
              syncedCount += movements.length;
            }
          }
        }

        await updateLastSync(service.id);
        await logger.success(syncedCount);

        results.push({
          service: service.service_name,
          success: true,
          recordsSynced: syncedCount,
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
