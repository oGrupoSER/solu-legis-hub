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
  console.log(`Creating ${termType}: ${term}`);

  try {
    // First, register with SOAP service
    await soapClient.call('cadastrar', {});

    // Then set the term based on type
    if (termType === 'office') {
      await soapClient.call('setEscritorio', { escritorio: term });
    } else if (termType === 'name') {
      await soapClient.call('setNomePesquisa', { nomePesquisa: term });
    } else {
      throw new Error(`Invalid term type: ${termType}`);
    }

    console.log('SOAP registration successful');

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

    return { local: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating term:', message);
    throw new Error(`Failed to create term: ${message}`);
  }
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
  console.log(`Updating term ${termId} to: ${newTerm}`);

  try {
    // Get current term
    const { data: currentTerm, error: fetchError } = await supabase
      .from('search_terms')
      .select('*')
      .eq('id', termId)
      .single();

    if (fetchError || !currentTerm) {
      throw new Error('Term not found');
    }

    // If term changed, update in Solucionare
    if (currentTerm.term !== newTerm) {
      // Remove old term
      if (termType === 'office') {
        await soapClient.call('remover', { escritorio: currentTerm.term });
      } else if (termType === 'name') {
        await soapClient.call('remover', { nomePesquisa: currentTerm.term });
      }

      // Add new term
      await soapClient.call('cadastrar', {});
      if (termType === 'office') {
        await soapClient.call('setEscritorio', { escritorio: newTerm });
      } else if (termType === 'name') {
        await soapClient.call('setNomePesquisa', { nomePesquisa: newTerm });
      }
    }

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

    return { local: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating term:', message);
    throw new Error(`Failed to update term: ${message}`);
  }
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
  console.log(`Deleting term: ${termId}`);

  try {
    // Get current term
    const { data: currentTerm, error: fetchError } = await supabase
      .from('search_terms')
      .select('*')
      .eq('id', termId)
      .single();

    if (fetchError || !currentTerm) {
      throw new Error('Term not found');
    }

    // Remove from Solucionare
    if (termType === 'office') {
      await soapClient.call('remover', { escritorio: currentTerm.term });
    } else if (termType === 'name') {
      await soapClient.call('remover', { nomePesquisa: currentTerm.term });
    }

    console.log('SOAP removal successful');

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

    return { local: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting term:', message);
    throw new Error(`Failed to delete term: ${message}`);
  }
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
