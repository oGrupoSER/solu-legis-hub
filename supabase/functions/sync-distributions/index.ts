/**
 * Sync Distributions Edge Function
 * Syncs new distributions from Solucionare WebAPI V3
 * Includes JWT authentication and full sync flow
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { Logger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DistributionService {
  id: string;
  partner_id: string;
  service_name: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  is_active: boolean;
}

interface AuthResponse {
  token: string;
  expiration: string;
}

/**
 * Authenticate with Solucionare API and get JWT token
 */
async function authenticateAPI(service: DistributionService): Promise<string> {
  const authUrl = `${service.service_url}/AutenticaAPI`;
  
  console.log(`Authenticating with: ${authUrl}`);
  
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      nomeRelacional: service.nome_relacional,
      token: service.token,
    }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
  }

  const data: AuthResponse = await response.json();
  console.log('Authentication successful, token expires:', data.expiration);
  
  return data.token;
}

/**
 * Make authenticated API request
 */
async function apiRequest(
  baseUrl: string,
  endpoint: string,
  jwtToken: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const url = `${baseUrl}${endpoint}`;
  
  console.log(`API Request: ${method} ${url}`);
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }
  
  return await response.text();
}

/**
 * Get active distribution services
 */
async function getActiveServices(supabase: any): Promise<DistributionService[]> {
  const { data, error } = await supabase
    .from('partner_services')
    .select('*')
    .eq('service_type', 'distributions')
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

/**
 * Fetch and sync new distributions
 */
async function syncDistributions(
  supabase: any,
  service: DistributionService,
  jwtToken: string
): Promise<number> {
  // Get search terms for this service
  const { data: searchTerms, error: termsError } = await supabase
    .from('search_terms')
    .select('*')
    .eq('partner_service_id', service.id)
    .eq('term_type', 'distribution')
    .eq('is_active', true);

  if (termsError) throw termsError;

  if (!searchTerms || searchTerms.length === 0) {
    console.log(`No distribution search terms for service ${service.service_name}`);
    return 0;
  }

  let syncedCount = 0;
  const distributionsToConfirm: number[] = [];

  for (const term of searchTerms) {
    console.log(`Fetching distributions for term: ${term.term}`);

    try {
      const distributions = await apiRequest(
        service.service_url,
        `/BuscaNovasDistribuicoes?termo=${encodeURIComponent(term.term)}`,
        jwtToken
      );

      if (!distributions || !Array.isArray(distributions)) {
        console.log(`No distributions found for term: ${term.term}`);
        continue;
      }

      for (const dist of distributions) {
        const { error: insertError } = await supabase
          .from('distributions')
          .upsert({
            process_number: dist.numeroProcesso,
            tribunal: dist.tribunal || null,
            term: term.term,
            distribution_date: dist.dataDistribuicao || null,
            partner_service_id: service.id,
            partner_id: service.partner_id,
            raw_data: dist,
          }, {
            onConflict: 'process_number,partner_service_id',
            ignoreDuplicates: true,
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
    } catch (error) {
      console.error(`Error fetching distributions for term ${term.term}:`, error);
    }
  }

  // DISABLED: Do not confirm receipt - legacy system is the official confirmer
  // if (distributionsToConfirm.length > 0) {
  //   try {
  //     await apiRequest(
  //       service.service_url,
  //       '/ConfirmaRecebimentoDistribuicoes',
  //       jwtToken,
  //       'POST',
  //       { ids: distributionsToConfirm }
  //     );
  //     console.log(`Confirmed receipt of ${distributionsToConfirm.length} distributions`);
  //   } catch (error) {
  //     console.error('Error confirming distributions:', error);
  //   }
  // }
  if (distributionsToConfirm.length > 0) {
    console.log(`Skipping confirmation for ${distributionsToConfirm.length} distributions (legacy system handles confirmations)`);
  }

  return syncedCount;
}

/**
 * Update last sync timestamp
 */
async function updateLastSync(supabase: any, serviceId: string): Promise<void> {
  await supabase
    .from('partner_services')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', serviceId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const services = await getActiveServices(supabase);

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active distribution services found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const results = [];

    for (const service of services) {
      try {
        await logger.start({
          partner_service_id: service.id,
          sync_type: 'distributions',
        });

        // Authenticate first
        const jwtToken = await authenticateAPI(service);

        // Sync distributions
        const syncedCount = await syncDistributions(supabase, service, jwtToken);

        await updateLastSync(supabase, service.id);
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
