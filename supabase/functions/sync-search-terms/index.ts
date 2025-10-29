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

// Resolve correct Solucionare endpoint and namespace from a WSDL URL
function resolveSolucionareEndpoint(serviceUrl: string): { endpoint: string; namespace: string } {
  try {
    const u = new URL(serviceUrl);
    // Remove query and .wsdl
    let base = `${u.protocol}//${u.host}`;
    const path = u.pathname.replace(/\/NomeService(\.wsdl)?$/i, '/').replace(/\/?$/,'');
    // Find '/recorte/webservice' root
    const idx = path.toLowerCase().indexOf('/recorte/webservice');
    if (idx !== -1) {
      const root = path.substring(0, idx + '/recorte/webservice'.length);
      const endpointPath = `${root}/20200116/service/nomes.php`;
      const full = `${base}${endpointPath}`;
      return { endpoint: full, namespace: full };
    }
    // Fallback: use original without wsdl
    const fallback = serviceUrl.replace(/\.wsdl(\?.*)?$/i, '').replace(/\?wsdl$/i, '');
    return { endpoint: fallback, namespace: fallback };
  } catch {
    const fallback = serviceUrl.replace(/\.wsdl(\?.*)?$/i, '').replace(/\?wsdl$/i, '');
    return { endpoint: fallback, namespace: fallback };
  }
}


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
    console.log('Fetching service:', serviceId);

    // Get service configuration
    const service = await getServiceById(serviceId);
    if (!service) {
      throw new Error('Service not found');
    }

    validateService(service);

    if (!service.is_active) {
      throw new Error('Service is not active');
    }

    console.log('=== Service Configuration ===');
    console.log('Service name:', service.service_name);
    console.log('Service type:', service.service_type);
    console.log('Service URL:', service.service_url);
    console.log('Nome Relacional:', service.nome_relacional);
    console.log('Token (masked):', '***' + service.token.slice(-4));
    console.log('Office Code:', service.office_code);

    // Validate office_code is configured
    if (!service.office_code) {
      throw new Error('Office code is required for this service. Please configure it in the service settings.');
    }

    // Compute correct SOAP endpoint and namespace
    const { endpoint, namespace } = resolveSolucionareEndpoint(service.service_url);
    console.log('Resolved SOAP endpoint:', endpoint);
    console.log('Resolved namespace:', namespace);

    // Initialize SOAP client with proper namespace and endpoint
    const soapClient = new SoapClient({
      serviceUrl: endpoint,
      nomeRelacional: service.nome_relacional,
      token: service.token,
      namespace,
    });
    
    console.log('SOAP Client initialized successfully');

    const result: SyncResult = {
      success: true,
      officesImported: 0,
      namesImported: 0,
      officesUpdated: 0,
      namesUpdated: 0,
      errors: [],
    };

    // Sync offices (escritórios) - using getEscritorios method
    try {
      console.log('\n=== Fetching Offices (Escritórios) ===');
      const offices = await soapClient.call('getEscritorios', {});
      console.log('Offices response type:', typeof offices);
      console.log('Is array?', Array.isArray(offices));
      console.log('Offices data:', JSON.stringify(offices).substring(0, 500));
      
      if (Array.isArray(offices) && offices.length > 0) {
        console.log(`✓ Found ${offices.length} offices`);

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
        console.log('⚠ No offices found or invalid response format');
        console.log('Response value:', offices);
      }
    } catch (error: any) {
      console.error('✗ Error fetching offices:', error);
      console.error('Error stack:', error.stack);
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch offices: ${message}`);
    }

    // Sync search names (nomes de pesquisa) - using getNomesPesquisa with codEscritorio
    try {
      console.log('\n=== Fetching Search Names (Nomes de Pesquisa) ===');
      
      // First, get all offices to query names for each one
      const offices = await soapClient.call('getEscritorios', {});
      
      if (!Array.isArray(offices) || offices.length === 0) {
        console.log('⚠ No offices found, skipping names sync');
      } else {
        console.log(`Found ${offices.length} offices, fetching names for office code ${service.office_code}`);
        
        // Use the office_code from service configuration
        console.log('Using office code:', service.office_code);
        const names = await soapClient.call('getNomesPesquisa', { codEscritorio: service.office_code });
        console.log('Names response type:', typeof names);
        console.log('Is array?', Array.isArray(names));
        console.log('Names data:', JSON.stringify(names).substring(0, 1000));
        
        if (Array.isArray(names) && names.length > 0) {
          console.log(`✓ Found ${names.length} search names`);

          for (const nameObj of names) {
            try {
              // Extract the main name from the complex object
              const searchName = nameObj.nome || nameObj.term;
              const codNome = nameObj.codNome;
              
              if (!searchName) {
                console.log('⚠ Skipping item without name:', JSON.stringify(nameObj).substring(0, 100));
                continue;
              }

              console.log(`Processing name: ${searchName} (code: ${codNome})`);

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

              // Also sync variations (variacoes) if they exist
              if (nameObj.variacoes && Array.isArray(nameObj.variacoes)) {
                console.log(`  Found ${nameObj.variacoes.length} variations for "${searchName}"`);
                for (const variacao of nameObj.variacoes) {
                  const variacaoTerm = variacao.termo;
                  if (!variacaoTerm) continue;

                  // Check if variation exists
                  const { data: existingVar } = await supabase
                    .from('search_terms')
                    .select('id')
                    .eq('term', variacaoTerm)
                    .eq('term_type', 'name')
                    .eq('partner_service_id', serviceId)
                    .single();

                  if (!existingVar) {
                    await supabase
                      .from('search_terms')
                      .insert({
                        term: variacaoTerm,
                        term_type: 'name',
                        partner_id: service.partner_id,
                        partner_service_id: serviceId,
                        is_active: true,
                      });
                    result.namesImported++;
                  }
                }
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              console.error(`Error syncing name object:`, message);
              console.error('Name object:', JSON.stringify(nameObj).substring(0, 200));
              result.errors.push(`Name sync error: ${message}`);
            }
          }
        } else {
          console.log('⚠ No search names found or invalid response format');
          console.log('Response value:', JSON.stringify(names).substring(0, 500));
        }
      }
    } catch (error: any) {
      console.error('✗ Error fetching search names:', error);
      console.error('Error stack:', error.stack);
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to fetch search names: ${message}`);
    }

    console.log('\n=== Sync Completed ===');
    console.log('Result:', JSON.stringify(result, null, 2));

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
