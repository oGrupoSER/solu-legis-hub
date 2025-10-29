/**
 * Sync Distributions Edge Function
 * Syncs new distributions from Solucionare WebAPI
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
    // Get all active distribution services
    const services = await getActiveServices('distributions');

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active distribution services found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const results = [];

    for (const service of services) {
      try {
        validateService(service);

        await logger.start({
          partner_service_id: service.id,
          sync_type: 'distributions',
        });

        const client = new RestClient({
          baseUrl: service.service_url,
          nomeRelacional: service.nome_relacional,
          token: service.token,
        });

        // Get search terms for this service
        const { data: searchTerms, error: termsError } = await supabase
          .from('search_terms')
          .select('*')
          .eq('partner_service_id', service.id)
          .eq('term_type', 'distribution')
          .eq('is_active', true);

        if (termsError) {
          throw termsError;
        }

        if (!searchTerms || searchTerms.length === 0) {
          console.log(`No search terms found for service ${service.service_name}`);
          await logger.success(0);
          results.push({
            service: service.service_name,
            success: true,
            recordsSynced: 0,
            message: 'No search terms configured',
          });
          continue;
        }

        let syncedCount = 0;
        const distributionsToConfirm: string[] = [];

        // For each term, fetch new distributions
        for (const term of searchTerms) {
          console.log(`Fetching distributions for term: ${term.term}`);

          const distributionsData = await client.get('/BuscaNovasDistribuicoes', {
            termo: term.term,
          });

          if (!distributionsData || !Array.isArray(distributionsData)) {
            console.log(`No distributions found for term: ${term.term}`);
            continue;
          }

          // Insert distributions
          for (const dist of distributionsData) {
            const { error: insertError } = await supabase
              .from('distributions')
              .insert({
                process_number: dist.numeroProcesso,
                tribunal: dist.tribunal || null,
                term: term.term,
                distribution_date: dist.dataDistribuicao || null,
                partner_service_id: service.id,
                partner_id: service.partner_id,
                raw_data: dist,
              });

            if (insertError) {
              console.error(`Error inserting distribution:`, insertError);
            } else {
              syncedCount++;
              if (dist.id) {
                distributionsToConfirm.push(dist.id);
              }
            }
          }
        }

        // Confirm receipt of distributions
        if (distributionsToConfirm.length > 0) {
          try {
            await client.post('/ConfirmaRecebimentoDistribuicoes', {
              ids: distributionsToConfirm,
            });
            console.log(`Confirmed receipt of ${distributionsToConfirm.length} distributions`);
          } catch (error) {
            console.error('Error confirming distributions:', error);
            // Don't fail the whole sync if confirmation fails
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
    console.error('Sync distributions error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
