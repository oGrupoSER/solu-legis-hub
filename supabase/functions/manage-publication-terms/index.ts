/**
 * Edge Function: manage-publication-terms
 * Manages publication search terms via SOAP WebService
 * Uses complete NomePesquisa object with variations, blocking terms, scopes
 * Deduplication logic via client_search_terms junction table
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
  variacoes?: string[];
  termos_bloqueio?: { termo: string; contido: boolean }[];
  abrangencias?: string[];
  oab?: string;
}

function resolveSolucionareEndpoint(serviceUrl: string): { endpoint: string; namespace: string } {
  try {
    const u = new URL(serviceUrl);
    const base = `${u.protocol}//${u.host}`;
    const path = u.pathname.replace(/\/NomeService(\.wsdl)?$/i, '/').replace(/\/?$/, '');
    
    const idx = path.toLowerCase().indexOf('/recorte/webservice');
    if (idx !== -1) {
      const root = path.substring(0, idx + '/recorte/webservice'.length);
      const endpointPath = `${root}/20200116/service/nomes.php`;
      const full = `${base}${endpointPath}`;
      return { endpoint: full, namespace: full };
    }
    
    const fallback = serviceUrl.replace(/\.wsdl(\?.*)?$/i, '').replace(/\?wsdl$/i, '');
    return { endpoint: fallback, namespace: fallback };
  } catch {
    const fallback = serviceUrl.replace(/\.wsdl(\?.*)?$/i, '').replace(/\?wsdl$/i, '');
    return { endpoint: fallback, namespace: fallback };
  }
}

async function getOfficeCode(serviceId: string): Promise<number> {
  const { data, error } = await supabase
    .from('partner_services')
    .select('partners(office_code)')
    .eq('id', serviceId)
    .single();

  if (error) throw new Error(`Failed to fetch service: ${error.message}`);
  const officeCode = (data?.partners as any)?.office_code as number | null;
  if (!officeCode) {
    throw new Error('Parceiro não possui código de escritório configurado.');
  }
  return officeCode;
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

/**
 * Build complete NomePesquisa object for SOAP
 */
function buildNomePesquisaObject(officeCode: number, term: string, data: Partial<TermRequest>): Record<string, any> {
  const nomePesquisa: Record<string, any> = {
    codEscritorio: officeCode,
    nome: term,
  };
  
  if (data.oab) nomePesquisa.oab = data.oab;
  
  if (data.variacoes?.length) {
    nomePesquisa.variacoes = data.variacoes.map((v: string) => ({ nome: v }));
  }
  
  if (data.termos_bloqueio?.length) {
    nomePesquisa.termosBloqueio = data.termos_bloqueio.map((tb) => ({
      termo: tb.termo,
      estaContidoNoNomePesquisa: tb.contido === true,
    }));
  }
  
  if (data.abrangencias?.length) {
    nomePesquisa.abrangencia = data.abrangencias;
  }
  
  return nomePesquisa;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: TermRequest = await req.json();
    const { service_id, client_system_id, term, term_type, operation, term_id } = requestData;

    console.log(`Managing publication term: ${operation} - ${term_type}`);

    const service = await getServiceById(service_id);
    if (!service) throw new Error(`Service not found: ${service_id}`);
    validateService(service);

    const officeCode = await getOfficeCode(service_id);
    const { endpoint, namespace } = resolveSolucionareEndpoint(service.service_url);
    
    const soapClient = new SoapClient({
      serviceUrl: endpoint,
      nomeRelacional: service.nome_relacional,
      token: service.token,
      namespace,
    });

    let result;

    switch (operation) {
      case 'create':
        result = await createTerm(soapClient, service, officeCode, term, term_type, requestData, client_system_id);
        break;
      case 'update':
        if (!term_id) throw new Error('term_id required for update');
        result = await updateTerm(soapClient, service, officeCode, term_id, term, term_type, requestData);
        break;
      case 'delete':
        if (!term_id) throw new Error('term_id required for delete');
        result = await deleteTerm(soapClient, service, officeCode, term_id, term_type, client_system_id);
        break;
      case 'list':
        result = await listTerms(soapClient, service, officeCode, term_type);
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
  soapClient: SoapClient, service: any, officeCode: number,
  term: string, termType: string, data: Partial<TermRequest>, clientSystemId?: string
): Promise<any> {
  console.log(`Creating ${termType}: ${term}`);

  // DEDUPLICATION
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
      if (termType === 'office') {
        await soapClient.call('cadastrarEscritorio', { escritorio: term });
      } else {
        // Use complete NomePesquisa object
        const nomePesquisa = buildNomePesquisaObject(officeCode, term, data);
        console.log('Registering NomePesquisa:', JSON.stringify(nomePesquisa).substring(0, 500));
        await soapClient.call('cadastrar', { nomePesquisa });
      }
      registeredInSolucionare = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to register with SOAP: ${message}`);
    }

    // Build metadata
    const metadata: any = {};
    if (data.variacoes?.length) metadata.variacoes = data.variacoes;
    if (data.termos_bloqueio?.length) metadata.termos_bloqueio = data.termos_bloqueio;
    if (data.abrangencias?.length) metadata.abrangencias = data.abrangencias;
    if (data.oab) metadata.oab = data.oab;

    const { data: inserted, error } = await supabase
      .from('search_terms')
      .insert({
        partner_id: service.partner_id,
        partner_service_id: service.id,
        term, term_type: termType,
        is_active: true,
        solucionare_status: 'synced',
        metadata: Object.keys(metadata).length > 0 ? metadata : {},
      })
      .select()
      .single();

    if (error) throw error;
    termRecord = inserted;
  }

  if (clientSystemId && termRecord?.id) {
    await linkTermToClient(termRecord.id, clientSystemId);
  }

  return { local: termRecord, registeredInSolucionare, linkedToClient: !!clientSystemId };
}

async function updateTerm(
  soapClient: SoapClient, service: any, officeCode: number,
  termId: string, newTerm: string, termType: string, data: Partial<TermRequest>
): Promise<any> {
  const { data: currentTerm, error: fetchError } = await supabase
    .from('search_terms').select('*').eq('id', termId).single();
  if (fetchError || !currentTerm) throw new Error('Term not found');

  if (termType === 'name' && currentTerm.solucionare_code) {
    // Use getNomePesquisa -> modify -> setNomePesquisa flow
    let currentObj: any;
    try {
      currentObj = await soapClient.call('getNomePesquisa', { codNome: currentTerm.solucionare_code });
    } catch (e) {
      console.warn('Failed to get current NomePesquisa:', e);
      currentObj = {};
    }

    const updatedObj: Record<string, any> = {
      codNome: currentTerm.solucionare_code,
      codEscritorio: currentObj?.codEscritorio || officeCode,
      nome: newTerm || currentObj?.nome || currentTerm.term,
    };

    if (data.oab !== undefined) updatedObj.oab = data.oab;
    else if (currentObj?.oab) updatedObj.oab = currentObj.oab;

    if (data.variacoes !== undefined) {
      updatedObj.variacoes = (data.variacoes || []).map((v: string) => ({ nome: v }));
    } else if (currentObj?.variacoes) {
      updatedObj.variacoes = currentObj.variacoes;
    }

    if (data.termos_bloqueio !== undefined) {
      updatedObj.termosBloqueio = (data.termos_bloqueio || []).map((tb: any) => ({
        termo: tb.termo,
        estaContidoNoNomePesquisa: tb.contido === true,
      }));
    } else if (currentObj?.termosBloqueio) {
      updatedObj.termosBloqueio = currentObj.termosBloqueio;
    }

    if (data.abrangencias !== undefined) {
      updatedObj.abrangencia = data.abrangencias;
    } else if (currentObj?.abrangencia) {
      updatedObj.abrangencia = currentObj.abrangencia;
    }

    await soapClient.call('setNomePesquisa', { nomePesquisa: updatedObj });
  } else if (currentTerm.term !== newTerm) {
    // Office or name without solucionare_code: remove + recreate
    if (termType === 'office') {
      try { await soapClient.call('removerEscritorio', { escritorio: currentTerm.term }); } catch { /* ignore */ }
      await soapClient.call('cadastrarEscritorio', { escritorio: newTerm });
    } else {
      try { await soapClient.call('remover', { codEscritorio: officeCode, codNome: 0 }); } catch { /* ignore */ }
      const nomePesquisa = buildNomePesquisaObject(officeCode, newTerm, data);
      await soapClient.call('cadastrar', { nomePesquisa });
    }
  }

  // Update local metadata
  const metadata: any = { ...(currentTerm.metadata as any || {}) };
  if (data.variacoes !== undefined) metadata.variacoes = data.variacoes;
  if (data.termos_bloqueio !== undefined) metadata.termos_bloqueio = data.termos_bloqueio;
  if (data.abrangencias !== undefined) metadata.abrangencias = data.abrangencias;
  if (data.oab !== undefined) metadata.oab = data.oab;

  const { data: updated, error } = await supabase
    .from('search_terms')
    .update({ term: newTerm, updated_at: new Date().toISOString(), metadata })
    .eq('id', termId)
    .select()
    .single();

  if (error) throw error;
  return { local: updated };
}

async function deleteTerm(
  soapClient: SoapClient, service: any, officeCode: number,
  termId: string, termType: string, clientSystemId?: string
): Promise<any> {
  const { data: currentTerm, error: fetchError } = await supabase
    .from('search_terms').select('*').eq('id', termId).single();
  if (fetchError || !currentTerm) throw new Error('Term not found');

  let removedFromSolucionare = false;

  const doRemove = async () => {
    if (termType === 'office') {
      await soapClient.call('removerEscritorio', { escritorio: currentTerm.term });
    } else {
      await soapClient.call('remover', {
        codEscritorio: officeCode,
        codNome: currentTerm.solucionare_code || 0,
      });
    }
    removedFromSolucionare = true;
  };

  if (clientSystemId) {
    const noMoreClients = await unlinkAndCheck(termId, clientSystemId);
    if (noMoreClients) {
      await doRemove();
      await supabase.from('search_terms')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', termId);
    }
  } else {
    await doRemove();
    await supabase.from('search_terms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', termId);
  }

  return { removedFromSolucionare };
}

async function listTerms(soapClient: SoapClient, service: any, officeCode: number, termType: string): Promise<any> {
  let soapResult;
  try {
    if (termType === 'office') {
      soapResult = await soapClient.call('getEscritorios', { codEscritorio: officeCode });
    } else {
      soapResult = await soapClient.call('getNomesPesquisa', { codEscritorio: officeCode });
    }
  } catch (e) {
    console.warn('SOAP list failed:', e);
    soapResult = [];
  }

  const { data: localTerms, error } = await supabase
    .from('search_terms')
    .select('*, client_search_terms(client_systems(id, name))')
    .eq('partner_service_id', service.id)
    .eq('term_type', termType)
    .eq('is_active', true);

  if (error) throw error;
  return { local: localTerms, soap: soapResult };
}
