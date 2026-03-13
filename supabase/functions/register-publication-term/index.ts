/**
 * Edge Function: register-publication-term
 * REST V2 flow for registering publication search terms at Solucionare
 * Flow: Authenticate → Register Name → (OAB) → Fetch Catalog → Register Coverage
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = 'https://atacadoinformacaojudicial.com.br/WebApiPublicacoesV2/api';
const COD_ESCRITORIO = 41;

interface RegisterRequest {
  service_id: string;
  nome: string;
  oab?: { numero: string; uf: string };
  client_ids?: string[];
}

async function apiCall(
  endpoint: string,
  method: string,
  tokenJWT: string,
  body: any | undefined,
  serviceId: string,
  syncLogId: string,
): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  const startTime = Date.now();

  console.log(`[API] ${method} ${url}`);
  if (body) console.log(`[API] Body: ${JSON.stringify(body).substring(0, 500)}`);

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tokenJWT ? { 'Authorization': `Bearer ${tokenJWT}` } : {}),
    },
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const durationMs = Date.now() - startTime;
  const responseText = await response.text();

  console.log(`[API] Response ${response.status} (${durationMs}ms): ${responseText.substring(0, 500)}`);

  // Log the API call with sync_log_id
  try {
    await supabase.from('api_call_logs').insert({
      sync_log_id: syncLogId,
      method,
      url,
      call_type: 'REST',
      partner_service_id: serviceId,
      request_body: body ? JSON.stringify(body).substring(0, 10000) : null,
      response_status: response.status,
      response_status_text: response.statusText,
      response_summary: responseText.substring(0, 2000),
      duration_ms: durationMs,
      error_message: response.ok ? null : responseText.substring(0, 500),
    });
  } catch (logErr) {
    console.warn('Failed to log API call:', logErr);
  }

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${responseText.substring(0, 300)}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let syncLogId: string | null = null;

  try {
    const request: RegisterRequest = await req.json();
    const { service_id, nome, oab, client_ids } = request;

    if (!service_id) throw new Error('service_id is required');
    if (!nome?.trim()) throw new Error('nome is required');

    console.log(`=== Register Publication Term ===`);
    console.log(`Nome: ${nome}, OAB: ${oab ? `${oab.numero}/${oab.uf}` : 'none'}`);

    // 1. Get service config
    const { data: service, error: svcErr } = await supabase
      .from('partner_services')
      .select('*')
      .eq('id', service_id)
      .single();

    if (svcErr || !service) throw new Error('Service not found');
    if (!service.is_active) throw new Error('Service is not active');

    const { nome_relacional, token: serviceToken } = service;
    if (!nome_relacional || !serviceToken) throw new Error('Service missing nomeRelacional or token');

    // Create sync_log entry
    const { data: syncLog, error: syncLogErr } = await supabase
      .from('sync_logs')
      .insert({
        partner_service_id: service_id,
        partner_id: service.partner_id,
        sync_type: 'register-publication-term',
        status: 'in_progress',
        started_at: new Date().toISOString(),
        records_synced: 0,
      })
      .select('id')
      .single();

    if (syncLogErr || !syncLog) {
      console.warn('Failed to create sync_log:', syncLogErr);
      syncLogId = 'unknown';
    } else {
      syncLogId = syncLog.id;
    }

    // 2. Authenticate → get JWT
    console.log('Step 1: Authenticating...');
    const authResult = await apiCall(
      '/Autenticacao/AutenticaAPI', 'POST', '',
      { nomeRelacional: nome_relacional, token: serviceToken },
      service_id, syncLogId!,
    );

    const tokenJWT = authResult?.tokenJWT;
    if (!tokenJWT) throw new Error('Authentication failed: no tokenJWT returned');

    // 3. Register name → get codNome
    console.log('Step 2: Registering name...');
    const nomeResult = await apiCall(
      '/Nome/nome_cadastrar', 'POST', tokenJWT,
      [{ codEscritorio: COD_ESCRITORIO, nome: nome.trim() }],
      service_id, syncLogId!,
    );

    let codNome: number | null = null;
    if (Array.isArray(nomeResult) && nomeResult.length > 0) {
      codNome = nomeResult[0]?.codNome || nomeResult[0];
    } else if (typeof nomeResult === 'number') {
      codNome = nomeResult;
    } else if (nomeResult?.codNome) {
      codNome = nomeResult.codNome;
    }

    if (!codNome) throw new Error(`Failed to get codNome from response: ${JSON.stringify(nomeResult)}`);
    console.log(`Name registered with codNome: ${codNome}`);

    // 4. Register OAB (if provided)
    let oabRegistered = false;
    if (oab?.numero && oab?.uf) {
      console.log('Step 3: Registering OAB...');
      const paddedNumero = oab.numero.padStart(6, '0');
      await apiCall(
        '/Oab/oab_Cadastrar', 'POST', tokenJWT,
        [{ codNome, uf: oab.uf.toUpperCase(), numero: paddedNumero, letra: 's' }],
        service_id, syncLogId!,
      );
      oabRegistered = true;
    }

    // 5. Fetch catalog → get all codDiario
    console.log('Step 4: Fetching diary catalog...');
    const catalogResult = await apiCall(
      '/Abrangencia/abrangencia_buscarCatalogo', 'GET', tokenJWT,
      undefined, service_id, syncLogId!,
    );

    let listCodDiarios: number[] = [];
    if (Array.isArray(catalogResult)) {
      listCodDiarios = catalogResult
        .map((item: any) => item?.codDiario || item?.cod_diario || (typeof item === 'number' ? item : null))
        .filter((v: any) => v !== null);
    }

    // 6. Register coverage
    let abrangenciaCount = 0;
    if (listCodDiarios.length > 0) {
      console.log('Step 5: Registering coverage...');
      await apiCall(
        '/Abrangencia/abrangencia_cadastrar', 'POST', tokenJWT,
        { codNome, listCodDiarios },
        service_id, syncLogId!,
      );
      abrangenciaCount = listCodDiarios.length;
    }

    // 7. Save locally in search_terms
    const metadata: Record<string, any> = {
      cod_nome: codNome,
      abrangencias: ['TODAS'],
    };
    if (oab?.numero && oab?.uf) {
      metadata.oab = `${oab.numero.padStart(6, '0')}|${oab.uf.toUpperCase()}`;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('search_terms')
      .insert({
        term: nome.trim(),
        term_type: 'name',
        partner_id: service.partner_id,
        partner_service_id: service.id,
        is_active: true,
        solucionare_code: codNome,
        solucionare_status: 'synced',
        metadata,
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;
    const termId = inserted.id;

    // 8. Link to clients
    if (client_ids && client_ids.length > 0) {
      const links = client_ids.map(clientId => ({
        search_term_id: termId,
        client_system_id: clientId,
      }));
      const { error: linkErr } = await supabase.from('client_search_terms').insert(links);
      if (linkErr) console.error('Error linking clients:', linkErr);
    }

    // Update sync_log → success
    if (syncLogId && syncLogId !== 'unknown') {
      await supabase.from('sync_logs').update({
        status: 'success',
        records_synced: 1,
        completed_at: new Date().toISOString(),
      }).eq('id', syncLogId);
    }

    console.log('=== Registration complete ===');

    return new Response(JSON.stringify({
      success: true,
      codNome,
      termId,
      oab_registered: oabRegistered,
      abrangencia_count: abrangenciaCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Update sync_log → error
    if (syncLogId && syncLogId !== 'unknown') {
      await supabase.from('sync_logs').update({
        status: 'error',
        error_message: message,
        completed_at: new Date().toISOString(),
      }).eq('id', syncLogId);
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
