/**
 * Edge Function: sync-publications
 * Syncs official diary publications from Solucionare SOAP WebService
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { RestClient } from '../_shared/rest-client.ts';
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
        console.log(`Service URL: ${service.service_url}`);
        console.log(`Nome Relacional: ${service.nome_relacional}`);
        console.log(`Token: ${service.token ? '***' + service.token.slice(-4) : 'NOT SET'}`);
        console.log(`Auth in Query: true (publications API)`);

        // Get active search terms for this service (optional - used for local matching)
        const { data: termsData, error: termsError } = await supabase
          .from('search_terms')
          .select('*')
          .eq('partner_service_id', service.id)
          .eq('term_type', 'publication')
          .eq('is_active', true);

        if (termsError) {
          throw termsError;
        }

        const terms = termsData || [];
        console.log(`Found ${terms.length} active publication terms for local matching`);
        if (terms.length === 0) {
          console.log('No terms found - will import all publications without term matching');
        }

      // Initialize REST client for publications (API uses query params for auth)
      const restClient = new RestClient({
        baseUrl: service.service_url,
        nomeRelacional: service.nome_relacional,
        token: service.token,
        authInQuery: true, // Publicações API requires auth in query params
      });

        let totalSynced = 0;

        // Sync publications using REST API
        if (start_date && end_date) {
          // Use period search
          totalSynced = await syncByPeriod(restClient, supabase, service, terms, start_date, end_date);
        } else {
          // Use new publications search
          totalSynced = await syncNewPublications(restClient, supabase, service, terms);
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
 * Sync publications by period using REST API
 */
async function syncByPeriod(
  restClient: RestClient,
  supabase: any,
  service: any,
  terms: any[],
  startDate: string,
  endDate: string
): Promise<number> {
  console.log(`Fetching publications from ${startDate} to ${endDate}`);

  const result = await restClient.get('', {
    dataInicio: startDate,
    dataFim: endDate,
  });

  console.log('Publications response:', JSON.stringify(result, null, 2));

  if (!result || typeof result !== 'object') {
    console.log('No publications found in period');
    return 0;
  }

  const publicationsRaw = (result && (result.ArrayOfPublicacoes?.Publicacoes ?? result.Publicacoes ?? result)) || [];
  const publications = Array.isArray(publicationsRaw) ? publicationsRaw : [publicationsRaw];
  return await processPublications(supabase, service, publications, terms);
}

/**
 * Sync new publications using REST API
 * Fetches publications in batches of up to 500 until no more are available
 */
async function syncNewPublications(
  restClient: RestClient,
  supabase: any,
  service: any,
  terms: any[]
): Promise<number> {
  console.log('Fetching publications in batches of up to 500...');
  
  let totalSynced = 0;
  let batchNumber = 1;
  let hasMore = true;
  const failedBatches: Array<{ batch: number; error: string }> = [];
  
  while (hasMore) {
    try {
      console.log(`\n=== Fetching batch ${batchNumber} ===`);
      
      const result = await restClient.get('');
      
      console.log('API Response type:', typeof result);
      console.log('API Response:', JSON.stringify(result, null, 2));
      
      if (!result || typeof result !== 'object') {
        console.log('No more publications available (null or non-object response)');
        hasMore = false;
        break;
      }
      
      const publicationsRaw = (result && (result.ArrayOfPublicacoes?.Publicacoes ?? result.Publicacoes ?? result)) || [];
      const publications = Array.isArray(publicationsRaw) ? publicationsRaw : [publicationsRaw];
      console.log(`Received ${publications.length} publications in batch ${batchNumber}`);
      
      if (publications.length === 0) {
        console.log('Empty batch received - no more data available');
        hasMore = false;
        break;
      }
      
      // Process batch
      const synced = await processPublications(supabase, service, publications, terms);
      totalSynced += synced;
      
      console.log(`=== Batch ${batchNumber} Summary ===`);
      console.log(`- Received: ${publications.length} publications`);
      console.log(`- New: ${synced} publications`);
      console.log(`- Duplicates: ${publications.length - synced}`);
      console.log(`- Total synced so far: ${totalSynced}`);
      console.log(`================================\n`);
      
      // If received less than 500, no more data available
      if (publications.length < 500) {
        console.log('Received less than 500 publications - no more data available');
        hasMore = false;
      }
      
      batchNumber++;
      
    } catch (batchError) {
      const errorMessage = batchError instanceof Error ? batchError.message : 'Unknown error';
      console.error(`Error processing batch ${batchNumber}:`, batchError);
      
      // Record failed batch but continue with next batch
      failedBatches.push({
        batch: batchNumber,
        error: errorMessage,
      });
      
      batchNumber++;
      
      // Stop after 3 consecutive errors to prevent infinite loop
      if (failedBatches.length >= 3) {
        console.error('Too many consecutive errors - stopping sync');
        hasMore = false;
      }
    }
  }
  
  console.log(`\n=== SYNC COMPLETED ===`);
  console.log(`Total batches processed: ${batchNumber - 1}`);
  console.log(`Total new publications: ${totalSynced}`);
  if (failedBatches.length > 0) {
    console.log(`Failed batches: ${failedBatches.length}`);
    console.log('Failed batch details:', JSON.stringify(failedBatches, null, 2));
  }
  console.log(`======================\n`);
  
  return totalSynced;
}

/**
 * Process and store publications using batch upsert
 * Maps fields according to Solucionare API documentation
 */
async function processPublications(
  supabase: any,
  service: any,
  publications: any[],
  terms: any[]
): Promise<number> {
  console.log(`Processing ${publications.length} publications...`);
  
  const publicationsToInsert = [];
  
  for (const pub of publications) {
    try {
      // Extract publication data according to Solucionare API docs (pages 13-14)
      const codPublicacao = pub.codPublicacao; // Unique ID
      const content = pub.conteudoPublicacao || ''; // Full content
      const gazetteName = pub.nomeDiario || ''; // Gazette name
      const publicationDate = pub.dataPublicacao ? String(pub.dataPublicacao).slice(0, 10) : null; // YYYY-MM-DD
      
      // Skip if no codPublicacao (required for deduplication)
      if (!codPublicacao) {
        console.warn('Publication missing codPublicacao, skipping:', pub);
        continue;
      }
      
      // Find matching terms (local matching)
      const matchedTerms = terms
        .filter((term) => content.toLowerCase().includes(term.term.toLowerCase()))
        .map((term) => term.term);
      
      publicationsToInsert.push({
        cod_publicacao: codPublicacao,
        partner_id: service.partner_id,
        partner_service_id: service.id,
        gazette_name: gazetteName,
        content,
        publication_date: publicationDate,
        matched_terms: matchedTerms,
        raw_data: pub,
      });
      
    } catch (pubError) {
      console.error('Error preparing publication:', pubError);
      // Continue with next publication
    }
  }
  
  if (publicationsToInsert.length === 0) {
    console.log('No valid publications to insert');
    return 0;
  }
  
  console.log(`Attempting to upsert ${publicationsToInsert.length} publications...`);
  
  // Batch upsert with conflict resolution on cod_publicacao
  const { data, error } = await supabase
    .from('publications')
    .upsert(publicationsToInsert, {
      onConflict: 'cod_publicacao',
      ignoreDuplicates: true, // Don't update if already exists
    })
    .select();
  
  if (error) {
    console.error('Error upserting publications:', error);
    throw error;
  }
  
  // Return how many were actually inserted (not duplicates)
  const insertedCount = data?.length || 0;
  console.log(`Successfully inserted ${insertedCount} new publications (${publicationsToInsert.length - insertedCount} were duplicates)`);
  
  return insertedCount;
}

// Note: Confirmation function removed as REST API may not require it
// If confirmation is needed, implement a new REST endpoint call here
