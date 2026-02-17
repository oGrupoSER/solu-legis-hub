/**
 * Edge Function: manage-search-terms
 * Complete SOAP administration for offices and search names
 * Supports: variations, blocking terms, scopes (abrangencias), OAB
 * Deduplication logic via client_search_terms junction table
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

function resolveSolucionareEndpoint(serviceUrl: string, module: 'nomes' | 'escritorios' = 'nomes'): { endpoint: string; namespace: string } {
  const phpFile = module === 'escritorios' ? 'escritorios.php' : 'nomes.php';
  try {
    const u = new URL(serviceUrl);
    let base = `${u.protocol}//${u.host}`;
    const path = u.pathname.replace(/\/NomeService(\.wsdl)?$/i, '/').replace(/\/?$/, '');
    
    const idx = path.toLowerCase().indexOf('/recorte/webservice');
    if (idx !== -1) {
      const root = path.substring(0, idx + '/recorte/webservice'.length);
      const endpointPath = `${root}/20200116/service/${phpFile}`;
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
  client_system_id?: string;
  action: 'cadastrar_nome' | 'editar_nome' | 'ativar_nome' | 'desativar_nome' | 'excluir_nome' |
          'cadastrar_escritorio' | 'ativar_escritorio' | 'desativar_escritorio' |
          'listar_nomes' | 'listar_escritorios' | 'sync_all' |
          'gerar_variacoes' | 'buscar_abrangencias' | 'visualizar_nome';
  data?: {
    nome?: string;
    cod_nome?: number;
    escritorio?: string;
    cod_escritorio?: number;
    instancias?: number[];
    variacoes?: string[];
    termos_bloqueio?: { termo: string; contido: boolean }[];
    abrangencias?: string[];
    oab?: string;
  };
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
    throw new Error('Parceiro não possui código de escritório configurado. Configure o office_code no cadastro do parceiro.');
  }
  return officeCode;
}

async function linkTermToClient(termId: string, clientSystemId: string): Promise<void> {
  const { error } = await supabase
    .from('client_search_terms')
    .upsert(
      { client_system_id: clientSystemId, search_term_id: termId },
      { onConflict: 'client_system_id,search_term_id' }
    );
  if (error) console.error('Error linking term to client:', error);
}

async function unlinkTermFromClient(termId: string, clientSystemId: string): Promise<boolean> {
  await supabase
    .from('client_search_terms')
    .delete()
    .eq('client_system_id', clientSystemId)
    .eq('search_term_id', termId);

  const { count } = await supabase
    .from('client_search_terms')
    .select('*', { count: 'exact', head: true })
    .eq('search_term_id', termId);

  return (count || 0) === 0;
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
      case 'gerar_variacoes':
        result.data = await gerarVariacoes(soapClient, data!);
        break;
      case 'buscar_abrangencias': {
        // getAbrangencias is on the Escritórios module, not Nomes
        const { endpoint: escEndpoint, namespace: escNamespace } = resolveSolucionareEndpoint(service.service_url, 'escritorios');
        const escSoapClient = new SoapClient({
          serviceUrl: escEndpoint,
          nomeRelacional: service.nome_relacional,
          token: service.token,
          namespace: escNamespace,
        });
        result.data = await buscarAbrangencias(escSoapClient);
      }
        break;
      case 'visualizar_nome':
        result.data = await visualizarNome(soapClient, data!);
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

// ========== NEW ACTIONS ==========

/**
 * Generate automatic variations for a name using gerarVariacoes SOAP method
 * type: 1 = name variations, 2 = OAB variations (format "CODE|UF")
 */
async function gerarVariacoes(soapClient: SoapClient, data: any): Promise<any> {
  if (!data.nome) throw new Error('nome is required for generating variations');
  const type = data.tipo_variacao || 1; // 1 = name, 2 = OAB
  
  console.log(`Generating variations for: ${data.nome}, type: ${type}`);
  const result = await soapClient.call('gerarVariacoes', {
    tipo: type,
    texto: data.nome,
  });
  
  console.log('gerarVariacoes result:', JSON.stringify(result).substring(0, 500));
  
  // Result should be an array of variation strings or objects
  let variacoes: string[] = [];
  if (Array.isArray(result)) {
    variacoes = result.map((item: any) => {
      if (typeof item === 'string') return item;
      return item.nome || item.variacao || String(item);
    });
  } else if (typeof result === 'string' && result.trim()) {
    variacoes = result.split('|').filter(Boolean);
  }
  
  return { variacoes };
}

/**
 * Fetch available scopes (abrangencias) via getAbrangencias SOAP method
 * Returns list of diary siglas (e.g., DJE-SP, DJE-MG, DOU)
 */
async function buscarAbrangencias(soapClient: SoapClient): Promise<any> {
  console.log('Fetching abrangencias...');
  const result = await soapClient.call('getAbrangencias', {});
  
  console.log('getAbrangencias result:', JSON.stringify(result).substring(0, 1000));
  
  // Result can be array of strings or array of objects
  let abrangencias: string[] = [];
  if (Array.isArray(result)) {
    abrangencias = result.map((item: any) => {
      if (typeof item === 'string') return item;
      return item.sigla || item.siglaDiario || item.nome || String(item);
    });
  }
  
  return { abrangencias };
}

/**
 * Get complete NomePesquisa object from Solucionare via getNomePesquisa
 * Returns variations, blocking terms, scopes, OAB as currently configured
 */
async function visualizarNome(soapClient: SoapClient, data: any): Promise<any> {
  if (!data.cod_nome) throw new Error('cod_nome is required');
  
  console.log(`Fetching NomePesquisa for codNome: ${data.cod_nome}`);
  const result = await soapClient.call('getNomePesquisa', {
    codNome: data.cod_nome,
  });
  
  console.log('getNomePesquisa result:', JSON.stringify(result).substring(0, 1000));
  
  // Parse the complex object into a structured response
  const nomePesquisa: any = {
    codNome: result?.codNome || data.cod_nome,
    nome: result?.nome || '',
    oab: result?.oab || '',
    codEscritorio: result?.codEscritorio || 0,
    variacoes: [],
    termosBloqueio: [],
    abrangencia: [],
  };
  
  // Parse variacoes
  if (Array.isArray(result?.variacoes)) {
    nomePesquisa.variacoes = result.variacoes.map((v: any) => 
      typeof v === 'string' ? v : (v.nome || v.variacao || String(v))
    );
  }
  
  // Parse termosBloqueio
  if (Array.isArray(result?.termosBloqueio)) {
    nomePesquisa.termosBloqueio = result.termosBloqueio.map((tb: any) => ({
      termo: tb.termo || '',
      estaContidoNoNomePesquisa: tb.estaContidoNoNomePesquisa === true || tb.estaContidoNoNomePesquisa === 'true',
    }));
  }
  
  // Parse abrangencia
  if (Array.isArray(result?.abrangencia)) {
    nomePesquisa.abrangencia = result.abrangencia.map((a: any) =>
      typeof a === 'string' ? a : (a.sigla || String(a))
    );
  }
  
  return { nomePesquisa };
}

// ========== NAME OPERATIONS (with deduplication) ==========

/**
 * Build the complete NomePesquisa XML object for SOAP registration
 */
function buildNomePesquisaObject(officeCode: number, data: any): Record<string, any> {
  const nomePesquisa: Record<string, any> = {
    codEscritorio: officeCode,
    nome: data.nome,
  };
  
  // OAB (optional)
  if (data.oab) {
    nomePesquisa.oab = data.oab;
  }
  
  // Variations array
  if (data.variacoes && Array.isArray(data.variacoes) && data.variacoes.length > 0) {
    nomePesquisa.variacoes = data.variacoes.map((v: string) => ({ nome: v }));
  }
  
  // Blocking terms array
  if (data.termos_bloqueio && Array.isArray(data.termos_bloqueio) && data.termos_bloqueio.length > 0) {
    nomePesquisa.termosBloqueio = data.termos_bloqueio.map((tb: any) => ({
      termo: tb.termo,
      estaContidoNoNomePesquisa: tb.contido === true,
    }));
  }
  
  // Scopes (abrangencias) array - these are string siglas
  if (data.abrangencias && Array.isArray(data.abrangencias) && data.abrangencias.length > 0) {
    nomePesquisa.abrangencia = data.abrangencias; // Array of strings, buildComplexParam wraps in <string>
  }
  
  return nomePesquisa;
}

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
    // Build complete NomePesquisa object and register via SOAP
    const nomePesquisa = buildNomePesquisaObject(officeCode, data);
    console.log('NomePesquisa object:', JSON.stringify(nomePesquisa).substring(0, 500));
    
    const soapResult = await soapClient.call('cadastrar', { nomePesquisa });
    console.log('SOAP cadastrar result:', soapResult);
    registeredInSolucionare = true;

    const solCode = typeof soapResult === 'number' ? soapResult :
                    soapResult?.codNome || soapResult?.cod_nome || null;

    // Build metadata for local storage
    const metadata: any = {};
    if (data.variacoes?.length) metadata.variacoes = data.variacoes;
    if (data.termos_bloqueio?.length) metadata.termos_bloqueio = data.termos_bloqueio;
    if (data.abrangencias?.length) metadata.abrangencias = data.abrangencias;
    if (data.oab) metadata.oab = data.oab;
    if (solCode) metadata.cod_nome = solCode;

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
        metadata,
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

/**
 * Edit a name using the correct flow: getNomePesquisa -> modify -> setNomePesquisa
 */
async function editarNome(
  soapClient: SoapClient, service: any, officeCode: number, data: any
): Promise<any> {
  if (!data.cod_nome) throw new Error('cod_nome is required');

  // Step 1: Get current state from Solucionare
  console.log('Fetching current NomePesquisa for editing...');
  let currentObj: any;
  try {
    currentObj = await soapClient.call('getNomePesquisa', { codNome: data.cod_nome });
    console.log('Current NomePesquisa:', JSON.stringify(currentObj).substring(0, 500));
  } catch (e) {
    console.warn('Failed to get current NomePesquisa, building from scratch:', e);
    currentObj = { codNome: data.cod_nome, codEscritorio: officeCode };
  }

  // Step 2: Build updated object
  const updatedObj: Record<string, any> = {
    codNome: data.cod_nome,
    codEscritorio: currentObj?.codEscritorio || officeCode,
    nome: data.nome || currentObj?.nome || '',
  };
  
  if (data.oab !== undefined) updatedObj.oab = data.oab;
  else if (currentObj?.oab) updatedObj.oab = currentObj.oab;
  
  // Variations
  if (data.variacoes !== undefined) {
    updatedObj.variacoes = (data.variacoes || []).map((v: string) => ({ nome: v }));
  } else if (currentObj?.variacoes) {
    updatedObj.variacoes = currentObj.variacoes;
  }
  
  // Blocking terms
  if (data.termos_bloqueio !== undefined) {
    updatedObj.termosBloqueio = (data.termos_bloqueio || []).map((tb: any) => ({
      termo: tb.termo,
      estaContidoNoNomePesquisa: tb.contido === true,
    }));
  } else if (currentObj?.termosBloqueio) {
    updatedObj.termosBloqueio = currentObj.termosBloqueio;
  }
  
  // Scopes
  if (data.abrangencias !== undefined) {
    updatedObj.abrangencia = data.abrangencias;
  } else if (currentObj?.abrangencia) {
    updatedObj.abrangencia = currentObj.abrangencia;
  }

  // Step 3: Send updated object via setNomePesquisa
  console.log('Setting updated NomePesquisa:', JSON.stringify(updatedObj).substring(0, 500));
  const soapResult = await soapClient.call('setNomePesquisa', { nomePesquisa: updatedObj });

  // Step 4: Update local DB
  const metadata: any = {};
  if (data.variacoes?.length) metadata.variacoes = data.variacoes;
  if (data.termos_bloqueio?.length) metadata.termos_bloqueio = data.termos_bloqueio;
  if (data.abrangencias?.length) metadata.abrangencias = data.abrangencias;
  if (data.oab) metadata.oab = data.oab;
  metadata.cod_nome = data.cod_nome;

  const updateData: any = { updated_at: new Date().toISOString(), metadata };
  if (data.nome) updateData.term = data.nome;

  await supabase
    .from('search_terms')
    .update(updateData)
    .eq('solucionare_code', data.cod_nome)
    .eq('partner_service_id', service.id);

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

  let termQuery = supabase.from('search_terms').select('id, solucionare_code').eq('partner_service_id', service.id).eq('term_type', 'name');
  if (data.cod_nome) termQuery = termQuery.eq('solucionare_code', data.cod_nome);
  else if (data.nome) termQuery = termQuery.eq('term', data.nome);
  
  const { data: termRecord } = await termQuery.maybeSingle();

  let removedFromSolucionare = false;

  if (termRecord && clientSystemId) {
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
