/**
 * Edge Function: manage-search-terms
 * Complete SOAP administration for offices and search names
 * Methods: cadastrar, editar, ativar, desativar, excluir, listar
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

// Resolve correct Solucionare endpoint and namespace from a WSDL URL
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
  action: 'cadastrar_nome' | 'editar_nome' | 'ativar_nome' | 'desativar_nome' | 'excluir_nome' |
          'cadastrar_escritorio' | 'ativar_escritorio' | 'desativar_escritorio' |
          'listar_nomes' | 'listar_escritorios' | 'sync_all';
  data?: {
    nome?: string;
    cod_nome?: number;
    escritorio?: string;
    cod_escritorio?: number;
    instancias?: number[]; // Array of instance codes for coverage
    variacoes?: string[]; // Array of name variations
  };
}

interface ManageResult {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ManageRequest = await req.json();
    const { service_id, action, data } = request;

    if (!service_id) {
      throw new Error('service_id is required');
    }

    console.log(`=== Manage Search Terms ===`);
    console.log(`Action: ${action}`);
    console.log(`Service ID: ${service_id}`);
    console.log(`Data:`, JSON.stringify(data));

    // Get service configuration
    const service = await getServiceById(service_id);
    if (!service) {
      throw new Error('Service not found');
    }

    validateService(service);

    if (!service.is_active) {
      throw new Error('Service is not active');
    }

    // Resolve office code
    let officeCode = service.office_code as number | null;
    if (!officeCode) {
      const { data: cs } = await supabase
        .from('client_systems')
        .select('office_code')
        .eq('is_active', true)
        .not('office_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      officeCode = (cs as any)?.office_code ?? null;
    }

    if (!officeCode) {
      throw new Error('Office code is required. Configure it on the service or client system.');
    }

    // Resolve SOAP endpoint
    const { endpoint, namespace } = resolveSolucionareEndpoint(service.service_url);
    console.log('Resolved endpoint:', endpoint);

    // Initialize SOAP client
    const soapClient = new SoapClient({
      serviceUrl: endpoint,
      nomeRelacional: service.nome_relacional,
      token: service.token,
      namespace,
    });

    let result: ManageResult = {
      success: true,
      action,
    };

    switch (action) {
      // ========== NAME OPERATIONS ==========
      case 'cadastrar_nome':
        result.data = await cadastrarNome(soapClient, supabase, service, officeCode, data!);
        break;

      case 'editar_nome':
        result.data = await editarNome(soapClient, supabase, service, officeCode, data!);
        break;

      case 'ativar_nome':
        result.data = await ativarNome(soapClient, supabase, service, officeCode, data!);
        break;

      case 'desativar_nome':
        result.data = await desativarNome(soapClient, supabase, service, officeCode, data!);
        break;

      case 'excluir_nome':
        result.data = await excluirNome(soapClient, supabase, service, officeCode, data!);
        break;

      case 'listar_nomes':
        result.data = await listarNomes(soapClient, officeCode);
        break;

      // ========== OFFICE OPERATIONS ==========
      case 'cadastrar_escritorio':
        result.data = await cadastrarEscritorio(soapClient, supabase, service, data!);
        break;

      case 'ativar_escritorio':
        result.data = await ativarEscritorio(soapClient, supabase, service, data!);
        break;

      case 'desativar_escritorio':
        result.data = await desativarEscritorio(soapClient, supabase, service, data!);
        break;

      case 'listar_escritorios':
        result.data = await listarEscritorios(soapClient, officeCode);
        break;

      // ========== SYNC ALL ==========
      case 'sync_all':
        result.data = await syncAll(soapClient, supabase, service, officeCode);
        await updateLastSync(service_id);
        break;

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    console.log('Result:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ========== NAME OPERATIONS ==========

async function cadastrarNome(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  officeCode: number,
  data: any
): Promise<any> {
  console.log('Cadastrando nome:', data.nome);

  if (!data.nome) {
    throw new Error('Nome is required');
  }

  // Call SOAP method to register name
  const soapResult = await soapClient.call('cadastrar', {
    codEscritorio: officeCode,
    nome: data.nome,
    variacoes: data.variacoes?.join('|') || '',
  });

  console.log('SOAP cadastrar result:', soapResult);

  // Insert into local database
  const { data: inserted, error } = await supabase
    .from('search_terms')
    .insert({
      term: data.nome,
      term_type: 'name',
      partner_id: service.partner_id,
      partner_service_id: service.id,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting term:', error);
    throw error;
  }

  // Insert variations as separate terms
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

  return { soapResult, local: inserted };
}

async function editarNome(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  officeCode: number,
  data: any
): Promise<any> {
  console.log('Editando nome:', data.cod_nome, '->', data.nome);

  if (!data.cod_nome) {
    throw new Error('cod_nome is required');
  }

  // Call SOAP method to update name instances/coverage
  const soapResult = await soapClient.call('editarInstanciaAbrangenciaNome', {
    codEscritorio: officeCode,
    codNome: data.cod_nome,
    instancias: data.instancias?.join(',') || '',
  });

  console.log('SOAP editar result:', soapResult);

  // Update local if name provided
  if (data.nome) {
    const { error } = await supabase
      .from('search_terms')
      .update({
        term: data.nome,
        updated_at: new Date().toISOString(),
      })
      .eq('term', data.nome)
      .eq('partner_service_id', service.id);

    if (error) console.error('Error updating local term:', error);
  }

  return { soapResult };
}

async function ativarNome(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  officeCode: number,
  data: any
): Promise<any> {
  console.log('Ativando nome:', data.cod_nome || data.nome);

  if (!data.cod_nome && !data.nome) {
    throw new Error('cod_nome or nome is required');
  }

  // Call SOAP method
  const soapResult = await soapClient.call('ativarNome', {
    codEscritorio: officeCode,
    codNome: data.cod_nome || 0,
  });

  console.log('SOAP ativar result:', soapResult);

  // Update local database
  if (data.nome) {
    await supabase
      .from('search_terms')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('term', data.nome)
      .eq('partner_service_id', service.id);
  }

  return { soapResult };
}

async function desativarNome(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  officeCode: number,
  data: any
): Promise<any> {
  console.log('Desativando nome:', data.cod_nome || data.nome);

  if (!data.cod_nome && !data.nome) {
    throw new Error('cod_nome or nome is required');
  }

  // Call SOAP method
  const soapResult = await soapClient.call('desativarNome', {
    codEscritorio: officeCode,
    codNome: data.cod_nome || 0,
  });

  console.log('SOAP desativar result:', soapResult);

  // Update local database
  if (data.nome) {
    await supabase
      .from('search_terms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('term', data.nome)
      .eq('partner_service_id', service.id);
  }

  return { soapResult };
}

async function excluirNome(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  officeCode: number,
  data: any
): Promise<any> {
  console.log('Excluindo nome:', data.cod_nome || data.nome);

  if (!data.cod_nome && !data.nome) {
    throw new Error('cod_nome or nome is required');
  }

  // Call SOAP method
  const soapResult = await soapClient.call('excluirNome', {
    codEscritorio: officeCode,
    codNome: data.cod_nome || 0,
  });

  console.log('SOAP excluir result:', soapResult);

  // Delete from local database
  if (data.nome) {
    await supabase
      .from('search_terms')
      .delete()
      .eq('term', data.nome)
      .eq('partner_service_id', service.id);
  }

  return { soapResult };
}

async function listarNomes(soapClient: SoapClient, officeCode: number): Promise<any> {
  console.log('Listando nomes para escritório:', officeCode);

  const result = await soapClient.call('getNomesPesquisa', {
    codEscritorio: officeCode,
  });

  console.log(`Found ${Array.isArray(result) ? result.length : 0} names`);
  return result;
}

// ========== OFFICE OPERATIONS ==========

async function cadastrarEscritorio(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  data: any
): Promise<any> {
  console.log('Cadastrando escritório:', data.escritorio);

  if (!data.escritorio) {
    throw new Error('escritorio name is required');
  }

  // Call SOAP method
  const soapResult = await soapClient.call('cadastrarEscritorio', {
    escritorio: data.escritorio,
  });

  console.log('SOAP cadastrarEscritorio result:', soapResult);

  // Insert into local database
  const { data: inserted, error } = await supabase
    .from('search_terms')
    .insert({
      term: data.escritorio,
      term_type: 'office',
      partner_id: service.partner_id,
      partner_service_id: service.id,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting office:', error);
    throw error;
  }

  return { soapResult, local: inserted };
}

async function ativarEscritorio(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  data: any
): Promise<any> {
  console.log('Ativando escritório:', data.cod_escritorio);

  if (!data.cod_escritorio) {
    throw new Error('cod_escritorio is required');
  }

  // Call SOAP method
  const soapResult = await soapClient.call('ativarEscritorio', {
    codEscritorio: data.cod_escritorio,
  });

  console.log('SOAP ativarEscritorio result:', soapResult);

  // Update local database
  if (data.escritorio) {
    await supabase
      .from('search_terms')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('term', data.escritorio)
      .eq('term_type', 'office')
      .eq('partner_service_id', service.id);
  }

  return { soapResult };
}

async function desativarEscritorio(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  data: any
): Promise<any> {
  console.log('Desativando escritório:', data.cod_escritorio);

  if (!data.cod_escritorio) {
    throw new Error('cod_escritorio is required');
  }

  // Call SOAP method
  const soapResult = await soapClient.call('desativarEscritorio', {
    codEscritorio: data.cod_escritorio,
  });

  console.log('SOAP desativarEscritorio result:', soapResult);

  // Update local database
  if (data.escritorio) {
    await supabase
      .from('search_terms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('term', data.escritorio)
      .eq('term_type', 'office')
      .eq('partner_service_id', service.id);
  }

  return { soapResult };
}

async function listarEscritorios(soapClient: SoapClient, officeCode: number): Promise<any> {
  console.log('Listando escritórios');

  // Some APIs may require different method names
  try {
    const result = await soapClient.call('getEscritorios', {
      codEscritorio: officeCode,
    });
    console.log(`Found ${Array.isArray(result) ? result.length : 0} offices`);
    return result;
  } catch (error) {
    // Fallback: try alternative method name
    console.log('Trying alternative method: buscarEscritorios');
    const result = await soapClient.call('buscarEscritorios', {
      codEscritorio: officeCode,
    });
    return result;
  }
}

// ========== SYNC ALL ==========

async function syncAll(
  soapClient: SoapClient,
  supabase: any,
  service: any,
  officeCode: number
): Promise<any> {
  console.log('=== Syncing all terms ===');

  const stats = {
    namesImported: 0,
    namesUpdated: 0,
    officesImported: 0,
    officesUpdated: 0,
    errors: [] as string[],
  };

  // Sync names
  try {
    const names = await soapClient.call('getNomesPesquisa', { codEscritorio: officeCode });
    
    if (Array.isArray(names)) {
      console.log(`Found ${names.length} names to sync`);

      for (const nameObj of names) {
        try {
          const searchName = nameObj.nome || nameObj.term;
          if (!searchName) continue;

          // Check if exists
          const { data: existing } = await supabase
            .from('search_terms')
            .select('id')
            .eq('term', searchName)
            .eq('term_type', 'name')
            .eq('partner_service_id', service.id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('search_terms')
              .update({ is_active: true, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
            stats.namesUpdated++;
          } else {
            await supabase.from('search_terms').insert({
              term: searchName,
              term_type: 'name',
              partner_id: service.partner_id,
              partner_service_id: service.id,
              is_active: true,
            });
            stats.namesImported++;
          }

          // Sync variations
          if (nameObj.variacoes && Array.isArray(nameObj.variacoes)) {
            for (const variacao of nameObj.variacoes) {
              const variacaoTerm = variacao.termo || variacao;
              if (!variacaoTerm) continue;

              const { data: existingVar } = await supabase
                .from('search_terms')
                .select('id')
                .eq('term', variacaoTerm)
                .eq('term_type', 'name')
                .eq('partner_service_id', service.id)
                .maybeSingle();

              if (!existingVar) {
                await supabase.from('search_terms').insert({
                  term: variacaoTerm,
                  term_type: 'name',
                  partner_id: service.partner_id,
                  partner_service_id: service.id,
                  is_active: true,
                });
                stats.namesImported++;
              }
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          stats.errors.push(`Name sync error: ${msg}`);
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(`Failed to fetch names: ${msg}`);
  }

  console.log('Sync stats:', stats);
  return stats;
}
