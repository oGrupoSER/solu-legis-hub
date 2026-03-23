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

// Default abrangências list (all Brazilian courts)
const DEFAULT_ABRANGENCIAS = [
  "CJM-1","CJM-10","CJM-11","CJM-12","CJM-2","CJM-3","CJM-4","CJM-5","CJM-6","CJM-7","CJM-8","CJM-9",
  "JF-AC","JF-AL","JF-AM","JF-AP","JF-BA","JF-CE","JF-DF","JF-ES","JF-GO","JF-MA","JF-MG","JF-MS","JF-MT",
  "JF-PA","JF-PB","JF-PE","JF-PI","JF-PR","JF-RJ","JF-RN","JF-RO","JF-RR","JF-RS","JF-SC","JF-SE","JF-SP","JF-TO",
  "STF","STJ",
  "TJ-AC","TJ-AL","TJ-AM","TJ-AP","TJ-BA","TJ-CE","TJ-DF","TJ-DFT","TJ-ES","TJ-GO","TJ-MA","TJ-MG",
  "TJM-MG","TJM-RS","TJ-MS","TJM-SP","TJ-MT","TJ-PA","TJ-PB","TJ-PE","TJ-PI","TJ-PR","TJ-RJ","TJ-RN","TJ-RO","TJ-RR",
  "TJ-RS","TJ-SC","TJ-SE","TJ-SP","TJ-TO",
  "TRE-AC","TRE-AL","TRE-AM","TRE-AP","TRE-BA","TRE-CE","TRE-DF","TRE-DFT","TRE-ES","TRE-GO","TRE-MA","TRE-MG",
  "TRE-MS","TRE-MT","TRE-PA","TRE-PB","TRE-PE","TRE-PI","TRE-PR","TRE-RJ","TRE-RN","TRE-RO","TRE-RR","TRE-RS",
  "TRE-SC","TRE-SE","TRE-SP","TRE-TO",
  "TRF-1","TRF-2","TRF-3","TRF-4","TRF-5","TRF-6",
  "TRT-1","TRT-10","TRT-11","TRT-12","TRT-13","TRT-14","TRT-15","TRT-16","TRT-17","TRT-18","TRT-19",
  "TRT-2","TRT-20","TRT-21","TRT-22","TRT-23","TRT-24",
  "TRT-3","TRT-4","TRT-5","TRT-6","TRT-7","TRT-8","TRT-9",
  "TSE","TST"
];

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
    const err: any = new Error(`API request failed: ${response.status} - ${errorText}`);
    err.apiStatus = response.status;
    err.apiBody = errorText;
    throw err;
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

async function getOfficeCodes(supabase: any, serviceId: string): Promise<{ serviceCode: number; partnerCode: number }> {
  const { data: serviceData, error: serviceError } = await supabase
    .from('partner_services')
    .select('config, partners(office_code)')
    .eq('id', serviceId)
    .single();
  if (serviceError) throw serviceError;
  
  const serviceConfig = serviceData?.config as Record<string, any> | null;
  const partnerCode = (serviceData?.partners as any)?.office_code as number | null;
  if (!partnerCode) throw new Error('Parceiro não possui código de escritório configurado.');
  
  // serviceCode: used for CadastrarNome (from config or fallback to partner)
  const serviceCode = serviceConfig?.office_code || partnerCode;
  
  return { serviceCode, partnerCode };
}

// Backward-compatible wrapper
async function getOfficeCode(supabase: any, serviceId: string): Promise<number> {
  const { serviceCode } = await getOfficeCodes(supabase, serviceId);
  return serviceCode;
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
    const { serviceCode: officeCode, partnerCode: partnerOfficeCode } = await getOfficeCodes(supabase, serviceId);
    let result;

    switch (action) {
      case 'rest_autenticar': {
        // Just return the JWT token for isolated auth testing
        result = { tokenJWT: jwtToken };
        break;
      }

      case 'rest_buscar_distribuicoes': {
        const { codEscritorio: codEscBusca } = params;
        const escCode = codEscBusca || partnerOfficeCode;
        try {
          result = await apiRequest(service.service_url, `/BuscaNovasDistribuicoes?codEscritorio=${escCode}`, jwtToken);
        } catch (e: any) {
          if (e.apiStatus === 400 || e.message?.includes('400')) {
            result = [];
          } else {
            throw e;
          }
        }
        break;
      }

      case 'listNames': {
        // Try fetching from API first
        let apiNames: any[] = [];
        console.log(`[listNames] Using officeCode=${officeCode}, partnerOfficeCode=${partnerOfficeCode}`);
        try {
          console.log(`[listNames] Trying BuscaNomesCadastrados with partnerOfficeCode=${partnerOfficeCode}`);
          const rawResponse = await apiRequest(service.service_url, `/BuscaNomesCadastrados?codEscritorio=${partnerOfficeCode}`, jwtToken);
          console.log(`[listNames] API returned ${Array.isArray(rawResponse) ? rawResponse.length : 0} names`);
          apiNames = Array.isArray(rawResponse) ? rawResponse : [];
        } catch (e: any) {
          console.log(`[listNames] API error: ${e.message}, apiStatus: ${e.apiStatus}, apiBody: ${e.apiBody}`);
          if (e.apiStatus === 400 || e.message?.includes('400')) {
            console.log('[listNames] Treating 400 as empty result');
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

          // Store full API metadata
          const apiMetadata = {
            codTipoConsulta: name.codTipoConsulta || null,
            listInstancias: name.listInstancias || [],
            listAbrangencias: name.listAbrangencias || [],
            qtdDiasCapturaRetroativa: name.qtdDiasCapturaRetroativa || null,
            listDocumentos: name.listDocumentos || [],
            listOab: name.listOab || [],
            forcarPesquisaExata: name.forcarPesquisaExata ?? null,
            tipoPoloPesquisa: name.tipoPoloPesquisa ?? null,
          };

          const { data: existing } = await supabase.from('search_terms')
            .select('id').eq('term', termo).eq('term_type', 'distribution')
            .eq('partner_service_id', serviceId).maybeSingle();

          if (existing) {
            await supabase.from('search_terms').update({ is_active: isActive, solucionare_code: solCode, solucionare_status: 'synced', metadata: apiMetadata, updated_at: new Date().toISOString() }).eq('id', existing.id);
            await linkTermToClients(existing.id);
          } else {
            const { data: inserted } = await supabase.from('search_terms').insert({ term: termo, term_type: 'distribution', partner_service_id: serviceId, partner_id: service.partner_id, is_active: isActive, solucionare_code: solCode, solucionare_status: 'synced', metadata: apiMetadata }).select('id').single();
            if (inserted) await linkTermToClients(inserted.id);
          }
        }

        // Clean up orphan local terms not present in API (trim for encoding safety)
        if (apiNames.length > 0) {
          const apiTermNames = apiNames.map((n: any) => (n.nome || n.Nome || n.term || '').trim()).filter(Boolean);
          console.log(`[listNames] API term names for orphan check: ${JSON.stringify(apiTermNames)}`);
          const { data: localTerms } = await supabase.from('search_terms')
            .select('id, term')
            .eq('term_type', 'distribution')
            .eq('partner_service_id', serviceId);

          const orphans = (localTerms || []).filter((lt: any) => !apiTermNames.includes((lt.term || '').trim()));
          if (orphans.length > 0) {
            console.log(`[listNames] Removing ${orphans.length} orphan local terms: ${orphans.map((o: any) => o.term).join(', ')}`);
            for (const orphan of orphans) {
              await supabase.from('client_search_terms').delete().eq('search_term_id', orphan.id);
              await supabase.from('search_terms').delete().eq('id', orphan.id);
            }
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
              // Use metadata from the term if available, otherwise use defaults
              const { data: termData } = await supabase.from('search_terms')
                .select('metadata').eq('id', pt.id).single();
              const meta = (termData?.metadata || {}) as Record<string, any>;

              await apiRequest(service.service_url, '/CadastrarNome', jwtToken, 'POST', {
                codEscritorio: officeCode,
                nome: pt.term,
                codTipoConsulta: meta.codTipoConsulta || 1,
                listInstancias: meta.listInstancias?.length ? meta.listInstancias : [1, 2, 3],
                listAbrangencias: meta.listAbrangencias?.length ? meta.listAbrangencias : DEFAULT_ABRANGENCIAS,
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
          listInstancias: listInstancias || [4],
          listAbrangencias: abrangencias || DEFAULT_ABRANGENCIAS,
          qtdDiasCapturaRetroativa: qtdDiasCapturaRetroativa || 90,
          listDocumentos: listDocumentos || [],
          listOab: listOab || [],
        };

        if (existing) {
          // Update metadata locally
          await supabase.from('search_terms').update({ metadata, updated_at: new Date().toISOString() }).eq('id', existing.id);
          termRecord = existing;
        } else {
          const finalAbrangencias = abrangencias && abrangencias.length > 0 ? abrangencias : DEFAULT_ABRANGENCIAS;
          const uniqueAbrangencias = [...new Set(finalAbrangencias)];
          const finalInstancias = listInstancias && listInstancias.length > 0 ? listInstancias : [1, 2, 3];
          const requestBody: any = {
            codEscritorio: officeCode,
            nome,
            codTipoConsulta: codTipoConsulta || 1,
            listInstancias: finalInstancias,
            listAbrangencias: uniqueAbrangencias,
          };
          if (qtdDiasCapturaRetroativa) requestBody.qtdDiasCapturaRetroativa = qtdDiasCapturaRetroativa;
          if (listDocumentos && listDocumentos.length > 0) requestBody.listDocumentos = listDocumentos;
          if (listOab && listOab.length > 0) requestBody.listOab = listOab;

          console.log(`[registerName] Request body (${uniqueAbrangencias.length} abrangencias):`, JSON.stringify(requestBody).substring(0, 500));
          
          try {
            const registerResult = await apiRequest(service.service_url, '/CadastrarNome', jwtToken, 'POST', requestBody);
            result = registerResult;
            registeredInSolucionare = true;
          } catch (apiError: any) {
            const errMsg = apiError.apiBody || apiError.message || '';
            if (errMsg.includes('já se encontra cadastrado') || errMsg.includes('já cadastrado')) {
              console.log(`[registerName] Name "${nome}" already exists at Solucionare, saving locally only`);
              registeredInSolucionare = false;
            } else if (errMsg.includes('truncated')) {
              throw new Error('A lista de abrangências excede o limite da API do parceiro. Selecione menos abrangências (recomendado: até 100).');
            } else {
              throw apiError;
            }
          }

          let solCode = result?.codNome || null;

          // If registration succeeded but codNome is null, fetch it from BuscaNomesCadastrados
          if (registeredInSolucionare && !solCode) {
            try {
              console.log(`[registerName] codNome not in response, fetching via BuscaNomesCadastrados with partnerOfficeCode=${partnerOfficeCode}`);
              const allNames = await apiRequest(service.service_url, `/BuscaNomesCadastrados?codEscritorio=${partnerOfficeCode}`, jwtToken);
              if (Array.isArray(allNames)) {
                const match = allNames.find((n: any) => {
                  const apiName = (n.nome || n.Nome || '').trim().toLowerCase();
                  return apiName === nome.trim().toLowerCase();
                });
                if (match) {
                  solCode = match.codNome || match.CodNome || null;
                  console.log(`[registerName] Found codNome=${solCode} for "${nome}"`);
                }
              }
            } catch (lookupErr) {
              console.error(`[registerName] Failed to lookup codNome:`, lookupErr);
            }
          }

          const { data: inserted } = await supabase.from('search_terms').insert({
            term: nome, term_type: 'distribution',
            partner_service_id: serviceId, partner_id: service.partner_id,
            is_active: true, solucionare_code: solCode,
            solucionare_status: registeredInSolucionare ? 'synced' : 'pending',
            metadata,
          }).select().single();
          termRecord = inserted;
        }

        if (client_system_id && termRecord?.id) {
          await linkTermToClient(supabase, termRecord.id, client_system_id);
        }

        result = { registeredInSolucionare, codNome: solCode, local: termRecord, linkedToClient: !!client_system_id, warning: !registeredInSolucionare ? 'Nome já existia no parceiro. Salvo localmente.' : undefined };
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
        const { nomeEscritorio, codAbrangencia, codEscritorio: regCodEsc, utilizaDocumentosIniciais } = params;
        // Support both legacy (nomeEscritorio) and V3 Postman format (codEscritorio + utilizaDocumentosIniciais)
        if (regCodEsc) {
          const body: any = { codEscritorio: regCodEsc };
          if (utilizaDocumentosIniciais !== undefined) body.utilizaDocumentosIniciais = utilizaDocumentosIniciais;
          result = await apiRequest(service.service_url, '/CadastrarEscritorio', jwtToken, 'POST', body);
        } else {
          if (!nomeEscritorio) throw new Error('nomeEscritorio or codEscritorio is required');
          result = await apiRequest(service.service_url, '/CadastrarEscritorio', jwtToken, 'POST', { nomeEscritorio, codAbrangencia: codAbrangencia || 1 });
        }
        break;
      }

      case 'activateOffice': {
        const { codEscritorio: codEsc } = params;
        if (!codEsc) throw new Error('codEscritorio is required');
        result = await apiRequest(service.service_url, '/AtivarEscritorio', jwtToken, 'POST', { codEscritorio: codEsc });
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

      case 'confirmDistributions': {
        const { distribuicoes, codEscritorio: codEsc } = params;
        if (!distribuicoes) throw new Error('distribuicoes array is required');
        const distList = typeof distribuicoes === 'string' ? JSON.parse(distribuicoes) : distribuicoes;
        result = await apiRequest(service.service_url, `/ConfirmaRecebimentoDistribuicoes?codEscritorio=${codEsc || partnerOfficeCode}`, jwtToken, 'POST', { distribuicoes: distList });
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
    // Use 400 for user-facing validation errors, 500 for unexpected failures
    const isValidationError = errorMsg.includes('limite da API') || errorMsg.includes('is required') || errorMsg.includes('Unknown action');
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: isValidationError ? 400 : 500 }
    );
  }
});
