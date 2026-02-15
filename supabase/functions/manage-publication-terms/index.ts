/**
 * Edge Function: manage-publication-terms
 * Manages publication search terms via SOAP WebService
 * Now with shared consumption (deduplication) logic
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
  client_system_id?: string;
  term: string;
  term_type: 'office' | 'name';
  operation: 'create' | 'update' | 'delete' | 'list';
  term_id?: string;
}

async function linkTermToClient(termId: string, clientSystemId: string): Promise<void> {
  await supabase
    .from('client_search_terms')
    .upsert({ client_system_id: clientSystemId, search_term_id: termId }, { onConflict: 'client_system_id,search_term_id' });
}

async function unlinkAndCheck(termId: string, clientSystemId: string): Promise<boolean> {
  await supabase.from('client_search_terms').delete()
    .eq('client_system_id', clientSystemId).eq('search_term_id', termId);
  const { count } = await supabase.from('client_search_terms')
    .select('*', { count: 'exact', head: true }).eq('search_term_id', termId);
  return (count || 0) === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { service_id, client_system_id, term, term_type, operation, term_id }: TermRequest = await req.json();

    console.log(`Managing publication term: ${operation} - ${term_type}`);

    const service = await getServiceById(service_id);
    if (!service) throw new Error(`Service not found: ${service_id}`);
    validateService(service);

    const soapClient = new SoapClient({
      serviceUrl: service.service_url,
      nomeRelacional: service.nome_relacional,
      token: service.token,
    });

    let result;

    switch (operation) {
      case 'create':
        result = await createTerm(soapClient, service, term, term_type, client_system_id);
        break;
      case 'update':
        if (!term_id) throw new Error('term_id required for update');
        result = await updateTerm(soapClient, service, term_id, term, term_type);
        break;
      case 'delete':
        if (!term_id) throw new Error('term_id required for delete');
        result = await deleteTerm(soapClient, service, term_id, term_type, client_system_id);
        break;
      case 'list':
        result = await listTerms(soapClient, service, term_type);
        break;
      default:
        throw new Error(`Invalid operation: ${operation}`);
    }

    return new Response(
      JSON.stringify({ success: true, operation, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error managing publication terms:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function createTerm(
  soapClient: SoapClient, service: any, term: string, termType: string, clientSystemId?: string
): Promise<any> {
  console.log(`Creating ${termType}: ${term}`);

  // DEDUPLICATION: Check if term already exists
  const { data: existing } = await supabase
    .from('search_terms')
    .select('id')
    .eq('term', term)
    .eq('term_type', termType)
    .eq('partner_service_id', service.id)
    .maybeSingle();

  let termRecord;
  let registeredInSolucionare = false;

  if (existing) {
    console.log('Term already exists, skipping SOAP registration');
    termRecord = existing;
  } else {
    try {
      await soapClient.call('cadastrar', {});
      if (termType === 'office') {
        await soapClient.call('setEscritorio', { escritorio: term });
      } else if (termType === 'name') {
        await soapClient.call('setNomePesquisa', { nomePesquisa: term });
      }
      registeredInSolucionare = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to register with SOAP: ${message}`);
    }

    const { data, error } = await supabase
      .from('search_terms')
      .insert({
        partner_id: service.partner_id,
        partner_service_id: service.id,
        term, term_type: termType,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    termRecord = data;
  }

  if (clientSystemId && termRecord?.id) {
    await linkTermToClient(termRecord.id, clientSystemId);
  }

  return { local: termRecord, registeredInSolucionare, linkedToClient: !!clientSystemId };
}

async function updateTerm(
  soapClient: SoapClient, service: any, termId: string, newTerm: string, termType: string
): Promise<any> {
  const { data: currentTerm, error: fetchError } = await supabase
    .from('search_terms').select('*').eq('id', termId).single();
  if (fetchError || !currentTerm) throw new Error('Term not found');

  if (currentTerm.term !== newTerm) {
    if (termType === 'office') {
      await soapClient.call('remover', { escritorio: currentTerm.term });
    } else {
      await soapClient.call('remover', { nomePesquisa: currentTerm.term });
    }
    await soapClient.call('cadastrar', {});
    if (termType === 'office') {
      await soapClient.call('setEscritorio', { escritorio: newTerm });
    } else {
      await soapClient.call('setNomePesquisa', { nomePesquisa: newTerm });
    }
  }

  const { data, error } = await supabase
    .from('search_terms')
    .update({ term: newTerm, updated_at: new Date().toISOString() })
    .eq('id', termId)
    .select()
    .single();

  if (error) throw error;
  return { local: data };
}

async function deleteTerm(
  soapClient: SoapClient, service: any, termId: string, termType: string, clientSystemId?: string
): Promise<any> {
  const { data: currentTerm, error: fetchError } = await supabase
    .from('search_terms').select('*').eq('id', termId).single();
  if (fetchError || !currentTerm) throw new Error('Term not found');

  let removedFromSolucionare = false;

  if (clientSystemId) {
    // DEDUPLICATION: Unlink, only remove from Solucionare if no clients remain
    const noMoreClients = await unlinkAndCheck(termId, clientSystemId);
    if (noMoreClients) {
      if (termType === 'office') {
        await soapClient.call('remover', { escritorio: currentTerm.term });
      } else {
        await soapClient.call('remover', { nomePesquisa: currentTerm.term });
      }
      removedFromSolucionare = true;
      await supabase.from('search_terms')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', termId);
    }
  } else {
    // No client context: direct removal
    if (termType === 'office') {
      await soapClient.call('remover', { escritorio: currentTerm.term });
    } else {
      await soapClient.call('remover', { nomePesquisa: currentTerm.term });
    }
    removedFromSolucionare = true;
    await supabase.from('search_terms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', termId);
  }

  return { removedFromSolucionare };
}

async function listTerms(soapClient: SoapClient, service: any, termType: string): Promise<any> {
  const soapMethod = termType === 'office' ? 'buscarEscritorios' : 'buscarNomesPesquisa';
  const soapResult = await soapClient.call(soapMethod, {});

  const { data: localTerms, error } = await supabase
    .from('search_terms')
    .select('*, client_search_terms(client_systems(id, name))')
    .eq('partner_service_id', service.id)
    .eq('term_type', termType)
    .eq('is_active', true);

  if (error) throw error;
  return { local: localTerms, soap: soapResult };
}
