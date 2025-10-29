/**
 * Sync Search Terms with Solucionare
 * Fetches all terms from Solucionare and syncs with local database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { SoapClient } from '../_shared/soap-client.ts';
import { getServiceById, validateService } from '../_shared/service-config.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  serviceId: string;
}

interface SyncResult {
  success: boolean;
  officesImported: number;
  namesImported: number;
  officesUpdated: number;
  namesUpdated: number;
  errors: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { serviceId } = await req.json() as SyncRequest;

    if (!serviceId) {
      throw new Error('Service ID is required');
    }

    console.log(`Starting sync for service: ${serviceId}`);

    // Get service configuration
    const service = await getServiceById(serviceId);
    if (!service) {
      throw new Error('Service not found');
    }

    validateService(service);

    if (!service.is_active) {
      throw new Error('Service is not active');
    }

    // Initialize SOAP client
    const soapClient = new SoapClient({
      serviceUrl: service.service_url,
      nomeRelacional: service.nome_relacional,
      token: service.token,
    });

    const result: SyncResult = {
      success: true,
      officesImported: 0,
      namesImported: 0,
      officesUpdated: 0,
      namesUpdated: 0,
      errors: [],
    };

    // Sync offices (escritórios)
    try {
      console.log('Fetching offices from Solucionare...');
      const offices = await soapClient.call('buscarEscritorios', {});
      console.log('Offices response:', offices);
      
      if (Array.isArray(offices) && offices.length > 0) {
        console.log(`Found ${offices.length} offices`);

        for (const officeName of offices) {
          try {
            // Check if term already exists
            const { data: existing } = await supabase
              .from('search_terms')
              .select('id')
              .eq('term', officeName)
              .eq('term_type', 'office')
              .eq('partner_service_id', serviceId)
              .single();

            if (existing) {
              // Update existing term
              const { error } = await supabase
                .from('search_terms')
                .update({
                  is_active: true,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

              if (error) throw error;
              result.officesUpdated++;
            } else {
              // Insert new term
              const { error } = await supabase
                .from('search_terms')
                .insert({
                  term: officeName,
                  term_type: 'office',
                  partner_id: service.partner_id,
                  partner_service_id: serviceId,
                  is_active: true,
                });

              if (error) throw error;
              result.officesImported++;
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error syncing office "${officeName}":`, message);
            result.errors.push(`Office "${officeName}": ${message}`);
          }
        }
      } else {
        console.log('No offices found in Solucionare');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching offices:', message);
      result.errors.push(`Failed to fetch offices: ${message}`);
    }

    // Sync search names (nomes de pesquisa)
    try {
      console.log('Fetching search names from Solucionare...');
      const names = await soapClient.call('buscarNomesPesquisa', {});
      console.log('Names response:', names);
      
      if (Array.isArray(names) && names.length > 0) {
        console.log(`Found ${names.length} search names`);

        for (const searchName of names) {
          try {
            // Check if term already exists
            const { data: existing } = await supabase
              .from('search_terms')
              .select('id')
              .eq('term', searchName)
              .eq('term_type', 'name')
              .eq('partner_service_id', serviceId)
              .single();

            if (existing) {
              // Update existing term
              const { error } = await supabase
                .from('search_terms')
                .update({
                  is_active: true,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

              if (error) throw error;
              result.namesUpdated++;
            } else {
              // Insert new term
              const { error } = await supabase
                .from('search_terms')
                .insert({
                  term: searchName,
                  term_type: 'name',
                  partner_id: service.partner_id,
                  partner_service_id: serviceId,
                  is_active: true,
                });

              if (error) throw error;
              result.namesImported++;
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error syncing name "${searchName}":`, message);
            result.errors.push(`Name "${searchName}": ${message}`);
          }
        }
      } else {
        console.log('No search names found in Solucionare');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching search names:', message);
      result.errors.push(`Failed to fetch search names: ${message}`);
    }

    console.log('Sync completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: message,
        officesImported: 0,
        namesImported: 0,
        officesUpdated: 0,
        namesUpdated: 0,
        errors: [message],
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
