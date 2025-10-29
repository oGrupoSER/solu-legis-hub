/**
 * Edge Function: sync-publications
 * Syncs official diary publications from Solucionare SOAP WebService
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { SoapClient } from '../_shared/soap-client.ts';
import { getActiveServices, updateLastSync, validateService } from '../_shared/service-config.ts';
import { Logger } from '../_shared/logger.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  service_id?: string;
  start_date?: string;
  end_date?: string;
  force?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();

  try {
    const { service_id, start_date, end_date, force = false }: SyncRequest = await req.json();

    console.log('Starting publications sync...');

    // Get active publication services
    const services = service_id
      ? [(await supabase.from('partner_services').select('*').eq('id', service_id).single()).data]
      : await getActiveServices('publications');

    if (!services || services.length === 0) {
      throw new Error('No active publication services found');
    }

    const results = [];

    for (const service of services) {
      try {
        validateService(service);

        await logger.start({
          partner_service_id: service.id,
          sync_type: 'publications',
        });

        console.log(`Syncing publications for service: ${service.service_name}`);

        // Get active search terms for this service
        const { data: terms, error: termsError } = await supabase
          .from('search_terms')
          .select('*')
          .eq('partner_service_id', service.id)
          .eq('term_type', 'publication')
          .eq('is_active', true);

        if (termsError) {
          throw termsError;
        }

        if (!terms || terms.length === 0) {
          console.log('No active publication terms found for this service');
          await logger.success(0);
          results.push({
            service_id: service.id,
            service_name: service.service_name,
            synced: 0,
            message: 'No active terms',
          });
          continue;
        }

        console.log(`Found ${terms.length} active publication terms`);

        // Initialize SOAP client
        const soapClient = new SoapClient({
          serviceUrl: service.service_url,
          nomeRelacional: service.nome_relacional,
          token: service.token,
        });

        let totalSynced = 0;

        // Sync publications
        if (start_date && end_date) {
          // Use period search
          totalSynced = await syncByPeriod(soapClient, supabase, service, terms, start_date, end_date);
        } else {
          // Use new publications search
          totalSynced = await syncNewPublications(soapClient, supabase, service, terms);
        }

        // Update last sync timestamp
        await updateLastSync(service.id);
        await logger.success(totalSynced);

        results.push({
          service_id: service.id,
          service_name: service.service_name,
          synced: totalSynced,
        });

        console.log(`Successfully synced ${totalSynced} publications for ${service.service_name}`);
      } catch (serviceError) {
        const errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
        console.error(`Error syncing service ${service.service_name}:`, serviceError);
        await logger.error(errorMessage);

        results.push({
          service_id: service.id,
          service_name: service.service_name,
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        total_services: services.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Publications sync failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (logger) {
      await logger.error(message);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Sync publications by period
 */
async function syncByPeriod(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  terms: any[],
  startDate: string,
  endDate: string
): Promise<number> {
  console.log(`Fetching publications from ${startDate} to ${endDate}`);

  const result = await soapClient.call('getPublicacoesPeriodo', {
    dataInicio: startDate,
    dataFim: endDate,
  });

  if (!result || typeof result !== 'object') {
    console.log('No publications found in period');
    return 0;
  }

  const publications = Array.isArray(result) ? result : [result];
  return await processPublications(supabase, service, publications, terms);
}

/**
 * Sync new publications
 */
async function syncNewPublications(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  terms: any[]
): Promise<number> {
  console.log('Fetching new publications');

  const result = await soapClient.call('getPublicacoes', {});

  if (!result || typeof result !== 'object') {
    console.log('No new publications found');
    return 0;
  }

  const publications = Array.isArray(result) ? result : [result];
  const synced = await processPublications(supabase, service, publications, terms);

  // Confirm receipt of publications
  if (synced > 0) {
    await confirmPublications(soapClient, publications);
  }

  return synced;
}

/**
 * Process and store publications
 */
async function processPublications(
  supabase: any,
  service: any,
  publications: any[],
  terms: any[]
): Promise<number> {
  let syncedCount = 0;

  for (const pub of publications) {
    try {
      // Extract publication data
      const content = pub.conteudo || pub.content || '';
      const gazetteName = pub.nomeGazeta || pub.gazette_name || '';
      const publicationDate = pub.dataPublicacao || pub.publication_date || null;

      // Find matching terms
      const matchedTerms = terms
        .filter((term) => content.toLowerCase().includes(term.term.toLowerCase()))
        .map((term) => term.term);

      // Insert publication
      const { error } = await supabase.from('publications').insert({
        partner_id: service.partner_id,
        partner_service_id: service.id,
        gazette_name: gazetteName,
        content,
        publication_date: publicationDate,
        matched_terms: matchedTerms,
        raw_data: pub,
      });

      if (error) {
        // Check if it's a duplicate
        if (error.code === '23505') {
          console.log('Publication already exists, skipping');
          continue;
        }
        throw error;
      }

      syncedCount++;
    } catch (pubError) {
      console.error('Error processing publication:', pubError);
      // Continue with next publication
    }
  }

  return syncedCount;
}

/**
 * Confirm receipt of publications via SOAP
 */
async function confirmPublications(soapClient: SoapClient, publications: any[]): Promise<void> {
  try {
    for (const pub of publications) {
      const publicationId = pub.id || pub.idPublicacao;
      if (publicationId) {
        await soapClient.call('confirmaRecebimentoPublicacao', {
          idPublicacao: publicationId,
        });
      }
    }
    console.log('Confirmed receipt of publications');
  } catch (error) {
    console.error('Error confirming publications:', error);
    // Non-critical error, don't throw
  }
}
