/**
 * Edge Function: manage-search-terms
 * Complete SOAP administration for offices and search names
 * Now with shared consumption (deduplication) logic:
 * - office_code sourced from partners table
 * - client_system_id links items to requesting client
 * - Deduplication: only registers with Solucionare if item is new to Hub
 * - Removal: only removes from Solucionare when no clients remain linked
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { SoapClient } from '../_shared/soap-client.ts';
import { getServiceById, validateService, updateLastSync } from '../_shared/service-config.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function resolveSolucionareEndpoint(serviceUrl: string): { endpoint: string; namespace: string } {
  try {
    const u = new URL(serviceUrl);
    let base = `${u.protocol}//${u.host}`;
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

interface ManageRequest {
  service_id: string;
  client_system_id?: string; // Optional: links the term to a client
  action: 'cadastrar_nome' | 'editar_nome' | 'ativar_nome' | 'desativar_nome' | 'excluir_nome' |
          'cadastrar_escritorio' | 'ativar_escritorio' | 'desativar_escritorio' |
          'listar_nomes' | 'listar_escritorios' | 'sync_all';
  data?: {
    nome?: string;
    cod_nome?: number;
    escritorio?: string;
    cod_escritorio?: number;
    instancias?: number[];
    variacoes?: string[];
  };
}

/**
 * Get office_code from partners table (via partner_services -> partners)
 */
async function getOfficeCode(serviceId: string): Promise<number> {
  const { data, error } = await supabase
    .from('partner_services')
    .select('partners(office_code)')
    .eq('id', serviceId)
    .single();

  if (error) throw new Error(`Failed to fetch service: ${error.message}`);
  
  const officeCode = (data?.partners as any)?.office_code as number | null;
  if (!officeCode) {
    throw new Error('Parceiro não possui código de escritório configurado. Configure o office_code no cadastro do parceiro.');
  }
  return officeCode;
}

/**
 * Link a search term to a client system (deduplication junction)
 */
async function linkTermToClient(termId: string, clientSystemId: string): Promise<void> {
  const { error } = await supabase
    .from('client_search_terms')
    .upsert(
      { client_system_id: clientSystemId, search_term_id: termId },
      { onConflict: 'client_system_id,search_term_id' }
    );
  if (error) console.error('Error linking term to client:', error);
}

/**
 * Unlink a search term from a client and check if others still use it
 */
async function unlinkTermFromClient(termId: string, clientSystemId: string): Promise<boolean> {
  // Remove the link
  await supabase
    .from('client_search_terms')
    .delete()
    .eq('client_system_id', clientSystemId)
    .eq('search_term_id', termId);

  // Check remaining links
  const { count } = await supabase
    .from('client_search_terms')
    .select('*', { count: 'exact', head: true })
    .eq('search_term_id', termId);

  return (count || 0) === 0; // true = no more clients, safe to remove from Solucionare
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ManageRequest = await req.json();
    const { service_id, client_system_id, action, data } = request;

    if (!service_id) throw new Error('service_id is required');

    console.log(`=== Manage Search Terms ===`);
    console.log(`Action: ${action}, Client: ${client_system_id || 'none'}`);

    const service = await getServiceById(service_id);
    if (!service) throw new Error('Service not found');
    validateService(service);
    if (!service.is_active) throw new Error('Service is not active');

    // Get office_code from partners table
    const officeCode = await getOfficeCode(service_id);

    const { endpoint, namespace } = resolveSolucionareEndpoint(service.service_url);
    const soapClient = new SoapClient({
      serviceUrl: endpoint,
      nomeRelacional: service.nome_relacional,
      token: service.token,
      namespace,
    });

    let result: any = { success: true, action };

    switch (action) {
      case 'cadastrar_nome':
        result.data = await cadastrarNome(soapClient, service, officeCode, data!, client_system_id);
        break;
      case 'editar_nome':
        result.data = await editarNome(soapClient, service, officeCode, data!);
        break;
      case 'ativar_nome':
        result.data = await ativarNome(soapClient, service, officeCode, data!);
        break;
      case 'desativar_nome':
        result.data = await desativarNome(soapClient, service, officeCode, data!);
        break;
      case 'excluir_nome':
        result.data = await excluirNome(soapClient, service, officeCode, data!, client_system_id);
        break;
      case 'listar_nomes':
        result.data = await listarNomes(soapClient, officeCode);
        break;
      case 'cadastrar_escritorio':
        result.data = await cadastrarEscritorio(soapClient, service, data!, client_system_id);
        break;
      case 'ativar_escritorio':
        result.data = await ativarEscritorio(soapClient, service, data!);
        break;
      case 'desativar_escritorio':
        result.data = await desativarEscritorio(soapClient, service, data!);
        break;
      case 'listar_escritorios':
        result.data = await listarEscritorios(soapClient, officeCode);
        break;
      case 'sync_all':
        result.data = await syncAll(soapClient, service, officeCode);
        await updateLastSync(service_id);
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========== NAME OPERATIONS (with deduplication) ==========

async function cadastrarNome(
  soapClient: SoapClient, service: any, officeCode: number, data: any, clientSystemId?: string
): Promise<any> {
  if (!data.nome) throw new Error('Nome is required');
  console.log('Cadastrando nome:', data.nome);

  // DEDUPLICATION: Check if term already exists
  const { data: existing } = await supabase
    .from('search_terms')
    .select('id, solucionare_code')
    .eq('term', data.nome)
    .eq('term_type', 'name')
    .eq('partner_service_id', service.id)
    .maybeSingle();

  let termRecord;
  let registeredInSolucionare = false;

  if (existing) {
    console.log('Term already exists locally, skipping Solucionare registration');
    termRecord = existing;
  } else {
    // Register with Solucionare (new to the Hub)
    const soapResult = await soapClient.call('cadastrar', {
      codEscritorio: officeCode,
      nome: data.nome,
      variacoes: data.variacoes?.join('|') || '',
    });
    console.log('SOAP cadastrar result:', soapResult);
    registeredInSolucionare = true;

    // Extract solucionare_code if returned
    const solCode = soapResult?.codNome || soapResult?.cod_nome || null;

    const { data: inserted, error } = await supabase
      .from('search_terms')
      .insert({
        term: data.nome,
        term_type: 'name',
        partner_id: service.partner_id,
        partner_service_id: service.id,
        is_active: true,
        solucionare_code: solCode,
        solucionare_status: 'synced',
      })
      .select()
      .single();

    if (error) throw error;
    termRecord = inserted;

    // Insert variations
    if (data.variacoes && Array.isArray(data.variacoes)) {
      for (const variacao of data.variacoes) {
        await supabase.from('search_terms').insert({
          term: variacao,
          term_type: 'name',
          partner_id: service.partner_id,
          partner_service_id: service.id,
          is_active: true,
        });
      }
    }
  }

  // Link to client if provided
  if (clientSystemId && termRecord?.id) {
    await linkTermToClient(termRecord.id, clientSystemId);
  }

  return { local: termRecord, registeredInSolucionare, linkedToClient: !!clientSystemId };
}

async function editarNome(
  soapClient: SoapClient, service: any, officeCode: number, data: any
): Promise<any> {
  if (!data.cod_nome) throw new Error('cod_nome is required');

  const soapResult = await soapClient.call('editarInstanciaAbrangenciaNome', {
    codEscritorio: officeCode,
    codNome: data.cod_nome,
    instancias: data.instancias?.join(',') || '',
  });

  if (data.nome) {
    await supabase
      .from('search_terms')
      .update({ term: data.nome, updated_at: new Date().toISOString() })
      .eq('solucionare_code', data.cod_nome)
      .eq('partner_service_id', service.id);
  }

  return { soapResult };
}

async function ativarNome(
  soapClient: SoapClient, service: any, officeCode: number, data: any
): Promise<any> {
  if (!data.cod_nome && !data.nome) throw new Error('cod_nome or nome is required');

  const soapResult = await soapClient.call('ativarNome', {
    codEscritorio: officeCode,
    codNome: data.cod_nome || 0,
  });

  const updateFilter = data.cod_nome
    ? supabase.from('search_terms').update({ is_active: true, updated_at: new Date().toISOString() }).eq('solucionare_code', data.cod_nome).eq('partner_service_id', service.id)
    : supabase.from('search_terms').update({ is_active: true, updated_at: new Date().toISOString() }).eq('term', data.nome).eq('partner_service_id', service.id);
  
  await updateFilter;
  return { soapResult };
}

async function desativarNome(
  soapClient: SoapClient, service: any, officeCode: number, data: any
): Promise<any> {
  if (!data.cod_nome && !data.nome) throw new Error('cod_nome or nome is required');

  const soapResult = await soapClient.call('desativarNome', {
    codEscritorio: officeCode,
    codNome: data.cod_nome || 0,
  });

  const updateFilter = data.cod_nome
    ? supabase.from('search_terms').update({ is_active: false, updated_at: new Date().toISOString() }).eq('solucionare_code', data.cod_nome).eq('partner_service_id', service.id)
    : supabase.from('search_terms').update({ is_active: false, updated_at: new Date().toISOString() }).eq('term', data.nome).eq('partner_service_id', service.id);
  
  await updateFilter;
  return { soapResult };
}

async function excluirNome(
  soapClient: SoapClient, service: any, officeCode: number, data: any, clientSystemId?: string
): Promise<any> {
  if (!data.cod_nome && !data.nome) throw new Error('cod_nome or nome is required');

  // Find the term record
  let termQuery = supabase.from('search_terms').select('id, solucionare_code').eq('partner_service_id', service.id).eq('term_type', 'name');
  if (data.cod_nome) termQuery = termQuery.eq('solucionare_code', data.cod_nome);
  else if (data.nome) termQuery = termQuery.eq('term', data.nome);
  
  const { data: termRecord } = await termQuery.maybeSingle();

  let removedFromSolucionare = false;

  if (termRecord && clientSystemId) {
    // DEDUPLICATION: Unlink client first, only remove from Solucionare if no clients remain
    const noMoreClients = await unlinkTermFromClient(termRecord.id, clientSystemId);
    
    if (noMoreClients) {
      console.log('No more clients linked, removing from Solucionare');
      await soapClient.call('remover', {
        codEscritorio: officeCode,
        codNome: data.cod_nome || termRecord.solucionare_code || 0,
      });
      removedFromSolucionare = true;

      await supabase.from('search_terms').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', termRecord.id);
    } else {
      console.log('Other clients still linked, keeping in Solucionare');
    }
  } else {
    // No client context: direct removal (legacy behavior)
    await soapClient.call('remover', {
      codEscritorio: officeCode,
      codNome: data.cod_nome || 0,
    });
    removedFromSolucionare = true;

    if (data.nome) {
      await supabase.from('search_terms').delete().eq('term', data.nome).eq('partner_service_id', service.id);
    }
  }

  return { removedFromSolucionare };
}

async function listarNomes(soapClient: SoapClient, officeCode: number): Promise<any> {
  return await soapClient.call('getNomesPesquisa', { codEscritorio: officeCode });
}

// ========== OFFICE OPERATIONS ==========

async function cadastrarEscritorio(
  soapClient: SoapClient, service: any, data: any, clientSystemId?: string
): Promise<any> {
  if (!data.escritorio) throw new Error('escritorio name is required');

  // DEDUPLICATION: Check if office already exists
  const { data: existing } = await supabase
    .from('search_terms')
    .select('id')
    .eq('term', data.escritorio)
    .eq('term_type', 'office')
    .eq('partner_service_id', service.id)
    .maybeSingle();

  let termRecord;
  let registeredInSolucionare = false;

  if (existing) {
    termRecord = existing;
  } else {
    const soapResult = await soapClient.call('cadastrarEscritorio', { escritorio: data.escritorio });
    registeredInSolucionare = true;

    const { data: inserted, error } = await supabase
      .from('search_terms')
      .insert({
        term: data.escritorio,
        term_type: 'office',
        partner_id: service.partner_id,
        partner_service_id: service.id,
        is_active: true,
        solucionare_status: 'synced',
      })
      .select()
      .single();

    if (error) throw error;
    termRecord = inserted;
  }

  if (clientSystemId && termRecord?.id) {
    await linkTermToClient(termRecord.id, clientSystemId);
  }

  return { local: termRecord, registeredInSolucionare };
}

async function ativarEscritorio(soapClient: SoapClient, service: any, data: any): Promise<any> {
  if (!data.cod_escritorio) throw new Error('cod_escritorio is required');
  const soapResult = await soapClient.call('ativarEscritorio', { codEscritorio: data.cod_escritorio });
  if (data.escritorio) {
    await supabase.from('search_terms').update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('term', data.escritorio).eq('term_type', 'office').eq('partner_service_id', service.id);
  }
  return { soapResult };
}

async function desativarEscritorio(soapClient: SoapClient, service: any, data: any): Promise<any> {
  if (!data.cod_escritorio) throw new Error('cod_escritorio is required');
  const soapResult = await soapClient.call('desativarEscritorio', { codEscritorio: data.cod_escritorio });
  if (data.escritorio) {
    await supabase.from('search_terms').update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('term', data.escritorio).eq('term_type', 'office').eq('partner_service_id', service.id);
  }
  return { soapResult };
}

async function listarEscritorios(soapClient: SoapClient, officeCode: number): Promise<any> {
  try {
    return await soapClient.call('getEscritorios', { codEscritorio: officeCode });
  } catch {
    return await soapClient.call('buscarEscritorios', { codEscritorio: officeCode });
  }
}

// ========== SYNC ALL ==========

async function syncAll(soapClient: SoapClient, service: any, officeCode: number): Promise<any> {
  console.log('=== Syncing all terms ===');
  const stats = { namesImported: 0, namesUpdated: 0, officesImported: 0, officesUpdated: 0, errors: [] as string[] };

  try {
    const names = await soapClient.call('getNomesPesquisa', { codEscritorio: officeCode });
    if (Array.isArray(names)) {
      for (const nameObj of names) {
        try {
          const searchName = nameObj.nome || nameObj.term;
          if (!searchName) continue;
          const solCode = nameObj.codNome || nameObj.cod_nome || null;

          const { data: existing } = await supabase
            .from('search_terms')
            .select('id')
            .eq('term', searchName)
            .eq('term_type', 'name')
            .eq('partner_service_id', service.id)
            .maybeSingle();

          if (existing) {
            await supabase.from('search_terms')
              .update({ is_active: true, solucionare_code: solCode, solucionare_status: 'synced', updated_at: new Date().toISOString() })
              .eq('id', existing.id);
            stats.namesUpdated++;
          } else {
            await supabase.from('search_terms').insert({
              term: searchName, term_type: 'name',
              partner_id: service.partner_id, partner_service_id: service.id,
              is_active: true, solucionare_code: solCode, solucionare_status: 'synced',
            });
            stats.namesImported++;
          }
        } catch (e) {
          stats.errors.push(`Name sync error: ${e instanceof Error ? e.message : 'Unknown'}`);
        }
      }
    }
  } catch (error) {
    stats.errors.push(`Failed to fetch names: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return stats;
}
