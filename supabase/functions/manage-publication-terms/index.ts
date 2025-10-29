/**
 * Edge Function: manage-publication-terms
 * Manages publication search terms via SOAP WebService
 * Syncs local search_terms with Solucionare's name/office service
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { SoapClient } from '../_shared/soap-client.ts';
import { getServiceById, validateService } from '../_shared/service-config.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TermRequest {
  service_id: string;
  term: string;
  term_type: 'office' | 'name';
  operation: 'create' | 'update' | 'delete' | 'list';
  term_id?: string; // For update/delete operations
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const { service_id, term, term_type, operation, term_id }: TermRequest = await req.json();

    console.log(`Managing publication term: ${operation} - ${term_type}`);

    // Get service configuration
    const service = await getServiceById(service_id);
    if (!service) {
      throw new Error(`Service not found: ${service_id}`);
    }

    validateService(service);

    // Initialize SOAP client
    const soapClient = new SoapClient({
      serviceUrl: service.service_url,
      nomeRelacional: service.nome_relacional,
      token: service.token,
    });

    let result;

    switch (operation) {
      case 'create':
        result = await createTerm(soapClient, supabase, service, term, term_type);
        break;

      case 'update':
        if (!term_id) throw new Error('term_id required for update');
        result = await updateTerm(soapClient, supabase, service, term_id, term, term_type);
        break;

      case 'delete':
        if (!term_id) throw new Error('term_id required for delete');
        result = await deleteTerm(soapClient, supabase, service, term_id, term_type);
        break;

      case 'list':
        result = await listTerms(soapClient, supabase, service, term_type);
        break;

      default:
        throw new Error(`Invalid operation: ${operation}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error managing publication terms:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

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
 * Create a new search term
 */
async function createTerm(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  term: string,
  termType: string
): Promise<any> {
  // Call SOAP service to register term
  const soapMethod = termType === 'office' ? 'cadastrar' : 'cadastrar';
  const soapParams = termType === 'office' 
    ? { nomeEscritorio: term }
    : { nomePesquisa: term };

  const soapResult = await soapClient.call(soapMethod, soapParams);
  console.log('SOAP cadastrar result:', soapResult);

  // Insert into local database
  const { data, error } = await supabase
    .from('search_terms')
    .insert({
      partner_id: service.partner_id,
      partner_service_id: service.id,
      term,
      term_type: termType,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting term:', error);
    throw error;
  }

  return { local: data, soap: soapResult };
}

/**
 * Update existing search term
 */
async function updateTerm(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  termId: string,
  newTerm: string,
  termType: string
): Promise<any> {
  // Get current term
  const { data: currentTerm, error: fetchError } = await supabase
    .from('search_terms')
    .select('*')
    .eq('id', termId)
    .single();

  if (fetchError || !currentTerm) {
    throw new Error('Term not found');
  }

  // Call SOAP service to update term
  const soapMethod = 'setEscritorio';
  const soapParams = termType === 'office'
    ? { nomeEscritorioAntigo: currentTerm.term, nomeEscritorioNovo: newTerm }
    : { nomePesquisaAntigo: currentTerm.term, nomePesquisaNovo: newTerm };

  const soapResult = await soapClient.call(soapMethod, soapParams);
  console.log('SOAP setEscritorio result:', soapResult);

  // Update in local database
  const { data, error } = await supabase
    .from('search_terms')
    .update({ term: newTerm, updated_at: new Date().toISOString() })
    .eq('id', termId)
    .select()
    .single();

  if (error) {
    console.error('Error updating term:', error);
    throw error;
  }

  return { local: data, soap: soapResult };
}

/**
 * Delete search term
 */
async function deleteTerm(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  termId: string,
  termType: string
): Promise<any> {
  // Get current term
  const { data: currentTerm, error: fetchError } = await supabase
    .from('search_terms')
    .select('*')
    .eq('id', termId)
    .single();

  if (fetchError || !currentTerm) {
    throw new Error('Term not found');
  }

  // Call SOAP service to remove term
  const soapMethod = 'remover';
  const soapParams = termType === 'office'
    ? { nomeEscritorio: currentTerm.term }
    : { nomePesquisa: currentTerm.term };

  const soapResult = await soapClient.call(soapMethod, soapParams);
  console.log('SOAP remover result:', soapResult);

  // Mark as inactive in local database (soft delete)
  const { data, error } = await supabase
    .from('search_terms')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', termId)
    .select()
    .single();

  if (error) {
    console.error('Error deleting term:', error);
    throw error;
  }

  return { local: data, soap: soapResult };
}

/**
 * List all search terms
 */
async function listTerms(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  termType: string
): Promise<any> {
  // Call SOAP service to get terms
  const soapMethod = termType === 'office' ? 'buscarEscritorios' : 'buscarNomesPesquisa';
  const soapResult = await soapClient.call(soapMethod, {});
  console.log('SOAP list result:', soapResult);

  // Get local terms
  const { data: localTerms, error } = await supabase
    .from('search_terms')
    .select('*')
    .eq('partner_service_id', service.id)
    .eq('term_type', termType)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching local terms:', error);
    throw error;
  }

  return { local: localTerms, soap: soapResult };
}
