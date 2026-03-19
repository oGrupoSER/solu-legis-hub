/**
 * Edge Function: api-management
 * Unified management API for system-to-system communication
 * Accepts API Token auth (same as query endpoints)
 * 
 * Actions:
 *   register-pub-term   - Register publication search term (with deduplication)
 *   delete-pub-term     - Unlink client; remove from Solucionare if last client
 *   register-dist-term  - Register distribution search term (with deduplication)
 *   delete-dist-term    - Unlink client; remove from Solucionare if last client
 *   register-process    - Register process for monitoring (with deduplication)
 *   delete-process      - Unlink client; remove from Solucionare if last client
 *   list-services       - List available partner services for this client
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { validateToken, logRequest, buildRateLimitHeaders } from '../_shared/auth-middleware.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PUB_API_BASE = 'https://atacadoinformacaojudicial.com.br/WebApiPublicacoesV2/api';
const COD_ESCRITORIO_PUB = 41;

// ─── Helper: Call internal edge function ───
async function callInternalFunction(functionName: string, body: any): Promise<any> {
  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ─── Helper: REST API call with logging ───
async function pubApiCall(endpoint: string, method: string, tokenJWT: string, body?: any): Promise<any> {
  const url = `${PUB_API_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tokenJWT ? { 'Authorization': `Bearer ${tokenJWT}` } : {}),
    },
  };
  if (body && method !== 'GET') options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const responseText = await response.text();
  
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${responseText.substring(0, 300)}`);
  }
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

// ─── Helper: Authenticate with Solucionare Publications REST V2 ───
async function authenticatePubV2(service: any): Promise<string> {
  const result = await pubApiCall('/Autenticacao/AutenticaAPI', 'POST', '', {
    nomeRelacional: service.nome_relacional,
    token: service.token,
  });
  const tokenJWT = result?.tokenJWT;
  if (!tokenJWT) throw new Error('Publication V2 authentication failed');
  return tokenJWT;
}

// ─── Helper: Authenticate with Solucionare Distribution REST V3 ───
async function authenticateDistV3(service: any): Promise<string> {
  const response = await fetch(`${service.service_url}/AutenticaAPI`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomeRelacional: service.nome_relacional, token: service.token }),
  });
  if (!response.ok) throw new Error(`Distribution auth failed: ${response.status}`);
  const data = await response.json();
  const token = typeof data === 'string' ? data.replace(/^"|"$/g, '') : data.token || data;
  return String(token);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  // Authenticate via API Token
  const auth = await validateToken(req);
  if (!auth.authenticated) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const clientSystemId = auth.clientSystemId;
  if (!clientSystemId) {
    return new Response(
      JSON.stringify({ success: false, error: 'Client system not found for this token' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { action, data: payload } = await req.json();
    if (!action) throw new Error('action is required');

    let result: any;

    switch (action) {
      // ═══════════════════════════════════════════════
      // PUBLICATION TERMS
      // ═══════════════════════════════════════════════
      case 'register-pub-term': {
        const { nome, oab, service_id } = payload || {};
        if (!nome?.trim()) throw new Error('nome is required');
        if (!service_id) throw new Error('service_id is required');

        // Check if term already exists
        const { data: existing } = await supabase
          .from('search_terms')
          .select('id, solucionare_code')
          .eq('term', nome.trim())
          .eq('term_type', 'name')
          .eq('partner_service_id', service_id)
          .maybeSingle();

        if (existing) {
          // Just link client
          await supabase.from('client_search_terms').upsert(
            { client_system_id: clientSystemId, search_term_id: existing.id },
            { onConflict: 'client_system_id,search_term_id' }
          );

          result = {
            success: true,
            term_id: existing.id,
            already_existed: true,
            solucionare_code: existing.solucionare_code,
          };
        } else {
          // Register at Solucionare via register-publication-term
          const registerResult = await callInternalFunction('register-publication-term', {
            service_id,
            nome: nome.trim(),
            oab: oab || undefined,
            client_ids: [clientSystemId],
          });

          if (!registerResult?.success) {
            throw new Error(registerResult?.error || 'Failed to register publication term');
          }

          result = {
            success: true,
            term_id: registerResult.termId,
            already_existed: false,
            solucionare_code: registerResult.codNome,
            oab_registered: registerResult.oab_registered,
            abrangencia_count: registerResult.abrangencia_count,
          };
        }
        break;
      }

      case 'delete-pub-term': {
        const { term_id, service_id } = payload || {};
        if (!term_id && !payload?.nome) throw new Error('term_id or nome is required');

        let termRecord: any;
        if (term_id) {
          const { data } = await supabase.from('search_terms').select('*').eq('id', term_id).single();
          termRecord = data;
        } else {
          const { data } = await supabase.from('search_terms')
            .select('*')
            .eq('term', payload.nome.trim())
            .eq('term_type', 'name')
            .eq('partner_service_id', service_id)
            .maybeSingle();
          termRecord = data;
        }

        if (!termRecord) throw new Error('Term not found');

        // Unlink this client
        await supabase.from('client_search_terms').delete()
          .eq('client_system_id', clientSystemId)
          .eq('search_term_id', termRecord.id);

        // Check if any other clients still use this term
        const { count } = await supabase.from('client_search_terms')
          .select('*', { count: 'exact', head: true })
          .eq('search_term_id', termRecord.id);

        let removedFromSolucionare = false;
        if ((count || 0) === 0 && termRecord.solucionare_code) {
          // No more clients — remove from Solucionare
          try {
            const { data: service } = await supabase.from('partner_services')
              .select('*').eq('id', termRecord.partner_service_id).single();
            
            if (service) {
              const tokenJWT = await authenticatePubV2(service);
              await pubApiCall('/Nome/nome_excluir', 'DELETE', tokenJWT, {
                codNome: termRecord.solucionare_code,
              });
              removedFromSolucionare = true;
            }
          } catch (e) {
            console.error('Error removing from Solucionare:', e);
          }

          // Mark as inactive
          await supabase.from('search_terms').update({ is_active: false }).eq('id', termRecord.id);
        }

        result = { success: true, unlinked: true, removedFromSolucionare };
        break;
      }

      // ═══════════════════════════════════════════════
      // DISTRIBUTION TERMS
      // ═══════════════════════════════════════════════
      case 'register-dist-term': {
        const { nome, service_id, codTipoConsulta, listInstancias, abrangencias, qtdDiasCapturaRetroativa, listDocumentos, listOab } = payload || {};
        if (!nome?.trim()) throw new Error('nome is required');
        if (!service_id) throw new Error('service_id is required');

        // Check if term already exists
        const { data: existing } = await supabase
          .from('search_terms')
          .select('id, solucionare_code')
          .eq('term', nome.trim())
          .eq('term_type', 'distribution')
          .eq('partner_service_id', service_id)
          .maybeSingle();

        if (existing) {
          // Just link client
          await supabase.from('client_search_terms').upsert(
            { client_system_id: clientSystemId, search_term_id: existing.id },
            { onConflict: 'client_system_id,search_term_id' }
          );

          result = {
            success: true,
            term_id: existing.id,
            already_existed: true,
            solucionare_code: existing.solucionare_code,
          };
        } else {
          // Register via manage-distribution-terms
          const registerResult = await callInternalFunction('manage-distribution-terms', {
            action: 'registerName',
            serviceId: service_id,
            client_system_id: clientSystemId,
            nome: nome.trim(),
            codTipoConsulta: codTipoConsulta || 1,
            listInstancias: listInstancias || [1, 2, 3],
            abrangencias: abrangencias && abrangencias.length > 0 ? abrangencias : undefined,
            qtdDiasCapturaRetroativa: qtdDiasCapturaRetroativa || null,
            listDocumentos: listDocumentos || [],
            listOab: listOab || [],
          });

          if (!registerResult?.success) {
            throw new Error(registerResult?.error || 'Failed to register distribution term');
          }

          const local = registerResult.data?.local;
          result = {
            success: true,
            term_id: local?.id || null,
            already_existed: false,
            solucionare_code: local?.solucionare_code || null,
            registeredInSolucionare: registerResult.data?.registeredInSolucionare,
          };
        }
        break;
      }

      case 'delete-dist-term': {
        const { term_id, service_id } = payload || {};
        if (!term_id && !payload?.nome) throw new Error('term_id or nome is required');

        let termRecord: any;
        if (term_id) {
          const { data } = await supabase.from('search_terms').select('*').eq('id', term_id).single();
          termRecord = data;
        } else {
          const { data } = await supabase.from('search_terms')
            .select('*')
            .eq('term', payload.nome.trim())
            .eq('term_type', 'distribution')
            .eq('partner_service_id', service_id)
            .maybeSingle();
          termRecord = data;
        }

        if (!termRecord) throw new Error('Term not found');

        // Unlink this client
        await supabase.from('client_search_terms').delete()
          .eq('client_system_id', clientSystemId)
          .eq('search_term_id', termRecord.id);

        // Check remaining clients
        const { count } = await supabase.from('client_search_terms')
          .select('*', { count: 'exact', head: true })
          .eq('search_term_id', termRecord.id);

        let removedFromSolucionare = false;
        if ((count || 0) === 0 && termRecord.solucionare_code) {
          try {
            const deleteResult = await callInternalFunction('manage-distribution-terms', {
              action: 'deleteName',
              serviceId: termRecord.partner_service_id,
              codNome: termRecord.solucionare_code,
              termo: termRecord.term,
            });
            removedFromSolucionare = deleteResult?.success || false;
          } catch (e) {
            console.error('Error removing dist term from Solucionare:', e);
          }
        }

        result = { success: true, unlinked: true, removedFromSolucionare };
        break;
      }

      // ═══════════════════════════════════════════════
      // PROCESSES
      // ═══════════════════════════════════════════════
      case 'register-process': {
        const { processNumber, instance, uf, service_id } = payload || {};
        if (!processNumber?.trim()) throw new Error('processNumber is required');
        if (!service_id) throw new Error('service_id is required');

        // Check if process already exists (any instance)
        const { data: existing } = await supabase
          .from('processes')
          .select('id, process_number, instance')
          .eq('process_number', processNumber.trim());

        if (existing && existing.length > 0) {
          // Process exists — just link client to all instances
          for (const proc of existing) {
            await supabase.from('client_processes').upsert(
              { client_system_id: clientSystemId, process_id: proc.id },
              { onConflict: 'client_system_id,process_id' }
            );
          }

          result = {
            success: true,
            process_ids: existing.map(p => p.id),
            already_existed: true,
            instances: existing.map(p => p.instance),
          };
        } else {
          // Register via sync-process-management
          const registerResult = await callInternalFunction('sync-process-management', {
            action: 'register',
            serviceId: service_id,
            processNumber: processNumber.trim(),
            clientSystemId,
          });

          if (!registerResult?.success) {
            throw new Error(registerResult?.error || 'Failed to register process');
          }

          // Get the newly created process records
          const { data: newProcesses } = await supabase
            .from('processes')
            .select('id, instance')
            .eq('process_number', processNumber.trim());

          result = {
            success: true,
            process_ids: (newProcesses || []).map(p => p.id),
            already_existed: false,
            registered: registerResult.registered,
            errors: registerResult.errors,
          };
        }
        break;
      }

      case 'delete-process': {
        const { processNumber, service_id } = payload || {};
        if (!processNumber?.trim()) throw new Error('processNumber is required');

        // Unlink this client from all instances
        const { data: allInstances } = await supabase
          .from('processes')
          .select('id')
          .eq('process_number', processNumber.trim());

        if (!allInstances || allInstances.length === 0) {
          throw new Error('Process not found');
        }

        for (const proc of allInstances) {
          await supabase.from('client_processes').delete()
            .eq('client_system_id', clientSystemId)
            .eq('process_id', proc.id);
        }

        // Check if any other clients still use this process
        const processIds = allInstances.map(p => p.id);
        const { count } = await supabase.from('client_processes')
          .select('*', { count: 'exact', head: true })
          .in('process_id', processIds);

        let removedFromSolucionare = false;
        if ((count || 0) === 0) {
          try {
            const deleteResult = await callInternalFunction('sync-process-management', {
              action: 'delete',
              serviceId: service_id || allInstances[0]?.id,
              processNumber: processNumber.trim(),
            });
            removedFromSolucionare = deleteResult?.success || false;
          } catch (e) {
            console.error('Error removing process from Solucionare:', e);
          }
        }

        result = { success: true, unlinked: true, removedFromSolucionare };
        break;
      }

      case 'status-process': {
        const { processNumber, service_id } = payload || {};
        if (!processNumber?.trim()) throw new Error('processNumber is required');
        if (!service_id) throw new Error('service_id is required');

        const statusResult = await callInternalFunction('sync-process-management', {
          action: 'status',
          serviceId: service_id,
          processNumber: processNumber.trim(),
        });

        if (!statusResult?.success) {
          throw new Error(statusResult?.error || 'Failed to get process status');
        }

        result = { success: true, statuses: statusResult.statuses };
        break;
      }

      // ═══════════════════════════════════════════════
      // LIST AVAILABLE SERVICES
      // ═══════════════════════════════════════════════
      case 'list-services': {
        // Get services this client has access to
        const { data: clientServices } = await supabase
          .from('client_system_services')
          .select('partner_service_id, is_active, partner_services(id, service_name, service_type, is_active)')
          .eq('client_system_id', clientSystemId)
          .eq('is_active', true);

        result = {
          success: true,
          services: (clientServices || []).map((cs: any) => ({
            service_id: cs.partner_service_id,
            service_name: cs.partner_services?.service_name,
            service_type: cs.partner_services?.service_type,
            is_active: cs.partner_services?.is_active,
          })),
        };
        break;
      }

      // ═══════════════════════════════════════════════
      // LIST CLIENT'S TERMS AND PROCESSES
      // ═══════════════════════════════════════════════
      case 'list-my-terms': {
        const { term_type } = payload || {};
        
        let query = supabase
          .from('client_search_terms')
          .select('search_term_id, search_terms(id, term, term_type, solucionare_code, solucionare_status, is_active, partner_service_id)')
          .eq('client_system_id', clientSystemId);

        const { data: links } = await query;

        let terms = (links || [])
          .map((l: any) => l.search_terms)
          .filter(Boolean);

        if (term_type) {
          terms = terms.filter((t: any) => t.term_type === term_type);
        }

        result = { success: true, terms };
        break;
      }

      case 'list-my-processes': {
        const { data: links } = await supabase
          .from('client_processes')
          .select('process_id, processes(id, process_number, instance, status, status_code, status_description, tribunal, uf)')
          .eq('client_system_id', clientSystemId);

        const processes = (links || []).map((l: any) => l.processes).filter(Boolean);
        result = { success: true, processes };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}. Available: register-pub-term, delete-pub-term, register-dist-term, delete-dist-term, register-process, delete-process, list-services, list-my-terms, list-my-processes`);
    }

    // Log the request
    const responseTime = Date.now() - startTime;
    await logRequest(auth.tokenId, clientSystemId, '/api-management', req.method, 200, responseTime, req);

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          ...buildRateLimitHeaders(auth),
        },
      }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('api-management error:', message);

    const responseTime = Date.now() - startTime;
    await logRequest(auth.tokenId, clientSystemId, '/api-management', req.method, 400, responseTime, req);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
