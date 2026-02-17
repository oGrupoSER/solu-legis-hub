/**
 * Manage Distribution Terms Edge Function
 * CRUD operations for distribution names/offices in Solucionare WebAPI V3
 * Now with shared consumption (deduplication) logic
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { SoapClient } from '../_shared/soap-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ServiceConfig {
  id: string;
  partner_id: string;
  service_url: string;
  nome_relacional: string;
  token: string;
}

async function authenticate(service: ServiceConfig): Promise<string> {
  const response = await fetch(`${service.service_url}/AutenticaAPI`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomeRelacional: service.nome_relacional, token: service.token }),
  });
  if (!response.ok) throw new Error(`Authentication failed: ${response.status}`);
  const data = await response.json();
  console.log(`[Auth] Response status: ${response.status}, data type: ${typeof data}`);
  const token = typeof data === 'string' ? data.replace(/^"|"$/g, '') : data.token || data;
  console.log(`[Auth] Token extracted, length: ${String(token).length}`);
  return token;
}

async function apiRequest(baseUrl: string, endpoint: string, jwtToken: string, method = 'GET', body?: any): Promise<any> {
  const url = `${baseUrl}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
  };
  if (body && method !== 'GET') options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }
  const contentType = response.headers.get('content-type');
  return contentType?.includes('application/json') ? await response.json() : await response.text();
}

async function getService(supabase: any, serviceId: string): Promise<ServiceConfig> {
  const { data, error } = await supabase.from('partner_services').select('*').eq('id', serviceId).single();
  if (error) throw error;
  if (!data) throw new Error('Service not found');
  return data;
}

async function getOfficeCode(supabase: any, serviceId: string): Promise<number> {
  // First check service-specific config for office_code override
  const { data: serviceData, error: serviceError } = await supabase
    .from('partner_services')
    .select('config, partners(office_code)')
    .eq('id', serviceId)
    .single();
  if (serviceError) throw serviceError;
  
  // Service-specific office_code takes priority (different APIs may use different codes)
  const serviceConfig = serviceData?.config as Record<string, any> | null;
  if (serviceConfig?.office_code) return serviceConfig.office_code;
  
  const officeCode = (serviceData?.partners as any)?.office_code as number | null;
  if (!officeCode) throw new Error('Parceiro não possui código de escritório configurado. Configure no serviço (config.office_code) ou no parceiro.');
  return officeCode;
}

async function linkTermToClient(supabase: any, termId: string, clientSystemId: string): Promise<void> {
  await supabase
    .from('client_search_terms')
    .upsert({ client_system_id: clientSystemId, search_term_id: termId }, { onConflict: 'client_system_id,search_term_id' });
}

async function unlinkAndCheck(supabase: any, termId: string, clientSystemId: string): Promise<boolean> {
  await supabase.from('client_search_terms').delete()
    .eq('client_system_id', clientSystemId).eq('search_term_id', termId);
  const { count } = await supabase.from('client_search_terms')
    .select('*', { count: 'exact', head: true }).eq('search_term_id', termId);
  return (count || 0) === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, serviceId, client_system_id, ...params } = await req.json();
    if (!serviceId) throw new Error('serviceId is required');

    const service = await getService(supabase, serviceId);
    const jwtToken = await authenticate(service);
    const officeCode = await getOfficeCode(supabase, serviceId);
    let result;

    switch (action) {
      case 'listNames': {
        // Try fetching from API first
        let apiNames: any[] = [];
        try {
          const rawResponse = await apiRequest(service.service_url, `/BuscaNomesCadastrados?codEscritorio=${officeCode}`, jwtToken);
          console.log(`[listNames] Full API response:`, JSON.stringify(rawResponse));
          apiNames = Array.isArray(rawResponse) ? rawResponse : [];
        } catch (e: any) {
          if (e.message?.includes('400')) {
            console.log('[listNames] No names found via API (400)');
            apiNames = [];
          } else {
            throw e;
          }
        }

        // Get clients entitled to this service for auto-linking
        const { data: entitledClients } = await supabase
          .from('client_system_services')
          .select('client_system_id')
          .eq('partner_service_id', serviceId)
          .eq('is_active', true);
        const clientIds = (entitledClients || []).map(c => c.client_system_id);
        console.log(`[listNames] ${clientIds.length} entitled clients for service ${serviceId}`);

        // Helper to link a search_term to all entitled clients
        const linkTermToClients = async (termId: string) => {
          for (const clientId of clientIds) {
            const { data: exists } = await supabase.from('client_search_terms')
              .select('id').eq('search_term_id', termId).eq('client_system_id', clientId).maybeSingle();
            if (!exists) {
              await supabase.from('client_search_terms').insert({ search_term_id: termId, client_system_id: clientId });
            }
          }
        };

        // Sync API names to search_terms
        for (const name of apiNames) {
          const termo = name.nome || name.Nome || name.term;
          if (!termo) continue;
          const solCode = name.codNome || name.CodNome || null;
          const isActive = name.ativo !== undefined ? !!name.ativo : true;

          const { data: existing } = await supabase.from('search_terms')
            .select('id').eq('term', termo).eq('term_type', 'distribution')
            .eq('partner_service_id', serviceId).maybeSingle();

          if (existing) {
            await supabase.from('search_terms').update({ is_active: isActive, solucionare_code: solCode, solucionare_status: 'synced', updated_at: new Date().toISOString() }).eq('id', existing.id);
            await linkTermToClients(existing.id);
          } else {
            const { data: inserted } = await supabase.from('search_terms').insert({ term: termo, term_type: 'distribution', partner_service_id: serviceId, partner_id: service.partner_id, is_active: isActive, solucionare_code: solCode, solucionare_status: 'synced' }).select('id').single();
            if (inserted) await linkTermToClients(inserted.id);
          }
        }

        // Also populate from synced distributions (terms already returned by API but registered via legacy)
        if (apiNames.length === 0) {
          console.log('[listNames] API empty, populating from distributions table');
          const { data: distTerms } = await supabase
            .from('distributions')
            .select('term')
            .eq('partner_service_id', serviceId)
            .not('term', 'is', null);

          const uniqueTerms = [...new Set((distTerms || []).map((d: any) => d.term).filter(Boolean))];
          console.log(`[listNames] Found ${uniqueTerms.length} unique terms from distributions`);

          for (const termo of uniqueTerms) {
            const { data: existing } = await supabase.from('search_terms')
              .select('id').eq('term', termo as string).eq('term_type', 'distribution')
              .eq('partner_service_id', serviceId).maybeSingle();

            if (!existing) {
              const { data: inserted } = await supabase.from('search_terms').insert({ term: termo as string, term_type: 'distribution', partner_service_id: serviceId, partner_id: service.partner_id, is_active: true }).select('id').single();
              if (inserted) await linkTermToClients(inserted.id);
            } else {
              await linkTermToClients(existing.id);
            }
          }
          apiNames = uniqueTerms.map(t => ({ nome: t }));
        }

        // RETRY: Re-send pending terms that failed to register with Solucionare
        const { data: pendingTerms } = await supabase.from('search_terms')
          .select('id, term')
          .eq('partner_service_id', serviceId)
          .eq('term_type', 'distribution')
          .eq('solucionare_status', 'pending')
          .eq('is_active', true);

        let retriedCount = 0;
        if (pendingTerms && pendingTerms.length > 0) {
          console.log(`[listNames] Retrying ${pendingTerms.length} pending terms`);
          for (const pt of pendingTerms) {
            try {
              await apiRequest(service.service_url, '/CadastrarNome', jwtToken, 'POST', {
                codEscritorio: officeCode,
                nome: pt.term,
                codTipoConsulta: 3,
                listInstancias: [1],
                listAbrangencias: [] as string[],
              });
              await supabase.from('search_terms').update({ solucionare_status: 'synced', updated_at: new Date().toISOString() }).eq('id', pt.id);
              retriedCount++;
            } catch (e) {
              console.error(`[retry] Failed to register term "${pt.term}":`, e);
              await supabase.from('search_terms').update({ solucionare_status: 'error', updated_at: new Date().toISOString() }).eq('id', pt.id);
            }
          }
          console.log(`[listNames] Retried ${retriedCount}/${pendingTerms.length} pending terms`);
        }

        result = apiNames;
        break;
      }

      case 'registerName': {
        const { nome, codTipoConsulta, listInstancias, abrangencias, qtdDiasCapturaRetroativa, listDocumentos, listOab } = params;
        if (!nome) throw new Error('nome is required');

        // DEDUPLICATION: Check if term exists
        const { data: existing } = await supabase
          .from('search_terms')
          .select('id, solucionare_code')
          .eq('term', nome)
          .eq('term_type', 'distribution')
          .eq('partner_service_id', serviceId)
          .maybeSingle();

        let termRecord;
        let registeredInSolucionare = false;

        const metadata = {
          codTipoConsulta: codTipoConsulta || 1,
          listInstancias: listInstancias || [1],
          listAbrangencias: abrangencias || [],
          qtdDiasCapturaRetroativa: qtdDiasCapturaRetroativa || null,
          listDocumentos: listDocumentos || [],
          listOab: listOab || [],
        };

        if (existing) {
          // Update metadata locally
          await supabase.from('search_terms').update({ metadata, updated_at: new Date().toISOString() }).eq('id', existing.id);
          termRecord = existing;
        } else {
          const requestBody: any = {
            codEscritorio: officeCode,
            nome,
            codTipoConsulta: codTipoConsulta || 1,
            listInstancias: (listInstancias || [1]).includes(4) ? [1, 2, 3] : (listInstancias || [1]),
            listAbrangencias: [...new Set(abrangencias || [])],
          };
          if (qtdDiasCapturaRetroativa) requestBody.qtdDiasCapturaRetroativa = qtdDiasCapturaRetroativa;
          if (listDocumentos && listDocumentos.length > 0) requestBody.listDocumentos = listDocumentos;
          if (listOab && listOab.length > 0) requestBody.listOab = listOab;

          console.log(`[registerName] Request body:`, JSON.stringify(requestBody));
          
          const registerResult = await apiRequest(service.service_url, '/CadastrarNome', jwtToken, 'POST', requestBody);
          result = registerResult;
          registeredInSolucionare = true;

          const solCode = result?.codNome || null;
          const { data: inserted } = await supabase.from('search_terms').insert({
            term: nome, term_type: 'distribution',
            partner_service_id: serviceId, partner_id: service.partner_id,
            is_active: true, solucionare_code: solCode, solucionare_status: 'synced',
            metadata,
          }).select().single();
          termRecord = inserted;
        }

        if (client_system_id && termRecord?.id) {
          await linkTermToClient(supabase, termRecord.id, client_system_id);
        }

        result = { registeredInSolucionare, local: termRecord, linkedToClient: !!client_system_id };
        break;
      }

      case 'editName': {
        const { termId, codNome, nome, codTipoConsulta: editTipo, listInstancias: editInst, abrangencias: editAbr, qtdDiasCapturaRetroativa: editRetro, listDocumentos: editDocs, listOab: editOabs } = params;
        if (!termId) throw new Error('termId is required');

        const metadata = {
          codTipoConsulta: editTipo || 1,
          listInstancias: editInst || [1],
          listAbrangencias: editAbr || [],
          qtdDiasCapturaRetroativa: editRetro || null,
          listDocumentos: editDocs || [],
          listOab: editOabs || [],
        };

        // If has codNome, try to edit on Solucionare (instancias + abrangencias)
        if (codNome) {
          try {
            await apiRequest(service.service_url, '/EditarInstanciaAbrangenciaNome', jwtToken, 'PUT', {
              codNome,
              listInstancias: editInst || [1],
              listAbrangencias: editAbr || [],
            });
            console.log(`[editName] Updated instancias/abrangencias on Solucionare for codNome ${codNome}`);
          } catch (e) {
            console.error(`[editName] Failed to update on Solucionare:`, e);
          }
        }

        await supabase.from('search_terms').update({
          term: nome || undefined,
          metadata,
          updated_at: new Date().toISOString(),
        }).eq('id', termId);

        result = { updated: true, termId };
        break;
      }

      case 'editNameScope': {
        const { codNome, instancia, abrangencia } = params;
        if (!codNome) throw new Error('codNome is required');
        result = await apiRequest(service.service_url, '/EditarInstanciaAbrangenciaNome', jwtToken, 'PUT', { codNome, instancia, abrangencia });
        break;
      }

      case 'activateName': {
        const { codNome } = params;
        if (!codNome) throw new Error('codNome is required');
        // CORRECTED: PATCH with body instead of PUT with query param
        result = await apiRequest(service.service_url, '/AtivarNome', jwtToken, 'PATCH', { codNome });
        await supabase.from('search_terms').update({ is_active: true }).eq('solucionare_code', codNome).eq('partner_service_id', serviceId);
        break;
      }

      case 'deactivateName': {
        const { codNome } = params;
        if (!codNome) throw new Error('codNome is required');
        // CORRECTED: PATCH with body instead of PUT with query param
        result = await apiRequest(service.service_url, '/DesativarNome', jwtToken, 'PATCH', { codNome });
        await supabase.from('search_terms').update({ is_active: false }).eq('solucionare_code', codNome).eq('partner_service_id', serviceId);
        break;
      }

      case 'deleteName': {
        const { codNome, termo } = params;
        if (!codNome) throw new Error('codNome is required');

        // DEDUPLICATION: Check client links
        const { data: termRecord } = await supabase.from('search_terms').select('id')
          .eq('solucionare_code', codNome).eq('partner_service_id', serviceId).maybeSingle();

        let removedFromSolucionare = false;

        if (termRecord && client_system_id) {
          const noMoreClients = await unlinkAndCheck(supabase, termRecord.id, client_system_id);
          if (noMoreClients) {
            // CORRECTED: DELETE with body instead of query param
            result = await apiRequest(service.service_url, '/ExcluirNome', jwtToken, 'DELETE', { codNome });
            removedFromSolucionare = true;
            await supabase.from('search_terms').update({ is_active: false }).eq('id', termRecord.id);
          }
        } else {
          // CORRECTED: DELETE with body instead of query param
          result = await apiRequest(service.service_url, '/ExcluirNome', jwtToken, 'DELETE', { codNome });
          removedFromSolucionare = true;
          if (termo) {
            await supabase.from('search_terms').delete()
              .eq('partner_service_id', serviceId).eq('term', termo).eq('term_type', 'distribution');
          }
        }

        result = { removedFromSolucionare };
        break;
      }

      case 'registerOffice': {
        const { nomeEscritorio, codAbrangencia } = params;
        if (!nomeEscritorio) throw new Error('nomeEscritorio is required');
        result = await apiRequest(service.service_url, '/CadastrarEscritorio', jwtToken, 'POST', { nomeEscritorio, codAbrangencia: codAbrangencia || 1 });
        break;
      }

      case 'activateOffice': {
        const { codEscritorio: codEsc } = params;
        if (!codEsc) throw new Error('codEscritorio is required');
        result = await apiRequest(service.service_url, `/AtivarEscritorio?codEscritorio=${codEsc}`, jwtToken, 'PUT');
        break;
      }

      case 'deactivateOffice': {
        const { codEscritorio: codEsc } = params;
        if (!codEsc) throw new Error('codEscritorio is required');
        result = await apiRequest(service.service_url, `/DesativarEscritorio?codEscritorio=${codEsc}`, jwtToken, 'PUT');
        break;
      }

      case 'listScopes': {
        result = await apiRequest(service.service_url, `/BuscaEscritoriosCadastrados?codEscritorio=${officeCode}`, jwtToken);
        break;
      }

      case 'listSystems': {
        result = await apiRequest(service.service_url, '/BuscaStatusSistemas', jwtToken);
        break;
      }

      case 'listAllNames': {
        try {
          result = await apiRequest(service.service_url, '/BuscaNomesCadastrados', jwtToken);
        } catch (e: any) {
          if (e.message?.includes('400')) {
            result = [];
          } else {
            throw e;
          }
        }
        break;
      }

      case 'listAbrangencias': {
        // Try SOAP getAbrangencias first (same source as publications)
        let siglas: string[] = [];
        let source = 'soap';
        
        try {
          // Find a SOAP service (terms or publications) from the same partner
          const { data: soapServices } = await supabase
            .from('partner_services')
            .select('*')
            .eq('partner_id', service.partner_id)
            .in('service_type', ['terms', 'publications'])
            .eq('is_active', true)
            .limit(1);
          
          if (soapServices && soapServices.length > 0) {
            const soapService = soapServices[0];
            // Build escritorios.php URL from the SOAP service URL
            let soapUrl = soapService.service_url;
            // If it points to nomesPesquisa.php or similar, change to escritorios.php
            if (soapUrl.includes('.php')) {
              soapUrl = soapUrl.replace(/[^/]+\.php.*$/, 'escritorios.php');
            } else if (!soapUrl.endsWith('/')) {
              soapUrl += '/escritorios.php';
            } else {
              soapUrl += 'escritorios.php';
            }
            
            console.log(`[listAbrangencias] Trying SOAP getAbrangencias at: ${soapUrl}`);
            const soapClient = new SoapClient({
              serviceUrl: soapUrl,
              nomeRelacional: soapService.nome_relacional,
              token: soapService.token,
            });
            
            const soapResult = await soapClient.call('getAbrangencias', {});
            if (Array.isArray(soapResult) && soapResult.length > 0) {
              siglas = soapResult.filter((s: any) => typeof s === 'string' && s.length > 0);
              console.log(`[listAbrangencias] Got ${siglas.length} diary siglas from SOAP`);
            }
          }
        } catch (soapErr) {
          console.error('[listAbrangencias] SOAP getAbrangencias failed, falling back to REST:', soapErr);
        }
        
        // Fallback: if SOAP didn't work, try REST BuscaStatusSistemas
        if (siglas.length === 0) {
          source = 'rest_fallback';
          try {
            const systems = await apiRequest(service.service_url, '/BuscaStatusSistemas', jwtToken);
            const systemsList = Array.isArray(systems) ? systems : [];
            siglas = systemsList.map((s: any) => s.siglaSistema || String(s.codSistema)).filter(Boolean);
            console.log(`[listAbrangencias] Fallback: got ${siglas.length} siglas from REST`);
          } catch (restErr) {
            console.error('[listAbrangencias] REST BuscaStatusSistemas also failed:', restErr);
          }
        }
        
        // Sort alphabetically
        siglas.sort((a, b) => a.localeCompare(b));
        
        result = { siglas, source };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Manage distribution terms error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
