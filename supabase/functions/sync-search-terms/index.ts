/**
 * Sync Search Terms – REST V2
 * Authenticates with Solucionare and fetches publications via publicacao_buscar.
 * All API calls are logged in api_call_logs linked to a sync_log entry.
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
    const { serviceId } = await req.json();
    if (!serviceId) throw new Error('serviceId is required');

    // Get service config
    const { data: service, error: svcErr } = await supabase
      .from('partner_services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (svcErr || !service) throw new Error('Service not found');
    if (!service.is_active) throw new Error('Service is not active');

    const { nome_relacional, token: serviceToken } = service;
    if (!nome_relacional || !serviceToken) throw new Error('Service missing nomeRelacional or token');

    // Create sync_log
    const { data: syncLog } = await supabase
      .from('sync_logs')
      .insert({
        partner_service_id: serviceId,
        partner_id: service.partner_id,
        sync_type: 'sync-publication-terms',
        status: 'in_progress',
        started_at: new Date().toISOString(),
        records_synced: 0,
      })
      .select('id')
      .single();

    syncLogId = syncLog?.id || null;

    // 1. Authenticate
    console.log('Step 1: Authenticating...');
    const authResult = await apiCall(
      '/Autenticacao/AutenticaAPI', 'POST', '',
      { nomeRelacional: nome_relacional, token: serviceToken },
      serviceId, syncLogId!,
    );

    const tokenJWT = authResult?.tokenJWT;
    if (!tokenJWT) throw new Error('Authentication failed: no tokenJWT returned');

    // 2. Fetch existing terms from Solucionare
    console.log('Step 2: Fetching existing terms from Solucionare...');
    let termsImported = 0;
    let codUltimoNome = 1;
    let hasMore = true;

    while (hasMore) {
      const termsResult = await apiCall(
        `/Nome/nome_buscarPorCodEscritorio?codEscritorio=${COD_ESCRITORIO}&codUltimoNome=${codUltimoNome}`,
        'GET', tokenJWT, undefined, serviceId, syncLogId!,
      );

      const names = Array.isArray(termsResult) ? termsResult : [];
      console.log(`Fetched ${names.length} terms (codUltimoNome=${codUltimoNome})`);

      if (names.length === 0) {
        hasMore = false;
        break;
      }

      for (const nameObj of names) {
        try {
          const nome = nameObj.nome || nameObj.name;
          const codNome = nameObj.codNome || nameObj.cod_nome;
          if (!nome) continue;

          // Check if term already exists locally
          const { data: existing } = await supabase
            .from('search_terms')
            .select('id')
            .eq('term', nome)
            .eq('term_type', 'name')
            .eq('partner_service_id', serviceId)
            .maybeSingle();

          if (!existing) {
            // Import term locally
            await supabase.from('search_terms').insert({
              term: nome,
              term_type: 'name',
              partner_id: service.partner_id,
              partner_service_id: serviceId,
              is_active: true,
              solucionare_code: codNome || null,
              solucionare_status: 'synced',
              metadata: codNome ? { cod_nome: codNome, abrangencias: ['TODAS'] } : {},
            });
            termsImported++;
            console.log(`Imported term: ${nome} (codNome: ${codNome})`);
          } else {
            // Update solucionare_code if we have it and it's missing locally
            if (codNome) {
              await supabase.from('search_terms').update({
                solucionare_code: codNome,
                solucionare_status: 'synced',
                updated_at: new Date().toISOString(),
              }).eq('id', existing.id);
            }
          }

          // Track pagination
          if (codNome && codNome > codUltimoNome) {
            codUltimoNome = codNome;
          }
        } catch (e) {
          console.error('Error processing term:', e);
        }
      }

      // If we got fewer results than expected, stop paginating
      if (names.length < 100) {
        hasMore = false;
      } else {
        codUltimoNome = codUltimoNome + 1;
      }
    }

    console.log(`Terms sync: ${termsImported} new terms imported`);

    // 3. Fetch publications
    console.log('Step 3: Fetching publications...');
    const pubResult = await apiCall(
      `/Publicacao/publicacao_buscar?codEscritorio=${COD_ESCRITORIO}`, 'GET', tokenJWT,
      undefined, serviceId, syncLogId!,
    );

    // 4. Process publication results
    let recordsSynced = 0;
    const publications = Array.isArray(pubResult) ? pubResult : [];
    console.log(`Received ${publications.length} publications`);

    for (const pub of publications) {
      try {
        const codPublicacao = pub.codPublicacao;
        if (!codPublicacao) continue;

        // Deduplicate by cod_publicacao
        const { data: existing } = await supabase
          .from('publications')
          .select('id')
          .eq('cod_publicacao', codPublicacao)
          .maybeSingle();

        if (existing) continue;

        await supabase.from('publications').insert({
          cod_publicacao: codPublicacao,
          hash_publicacao: pub.hashPublicaco || null,
          cod_escritorio: pub.codEscritorio || null,
          content: pub.conteudoPublicacao || null,
          gazette_name: pub.nomeDiario || null,
          publication_date: pub.dataPublicacao || null,
          data_vsap: pub.dataVSap || null,
          data_disponibilizacao: pub.dataDisponibilizacao || null,
          vara: pub.vara || null,
          comarca: pub.comarca || null,
          orgao: pub.orgao || null,
          nome_caderno: pub.nomeCaderno || null,
          sigla_diario: pub.siglaDiario || null,
          esfera_diario: pub.esferaDiario || null,
          num_edicao: pub.numEdicao || null,
          num_processo: pub.numProcesso || null,
          id_nome: pub.idNome || null,
          cod_mapa_diario: pub.codMapaDiario || null,
          nome_pesquisado: pub.nomePesquisado || null,
          termo_pesquisado: pub.termoPesquisado || null,
          oab: pub.oab || null,
          estado: pub.estado || null,
          uf: pub.uf || null,
          area: pub.area || null,
          perfil_contratante: pub.perfilContratante || null,
          outros_termos: pub.outrosTermosDePesquisaEncontrados || null,
          controle_pg: pub.controlePg ?? null,
          complemento: pub.complemento ?? null,
          tipo_fonte_conteudo: pub.tipoFonteConteudo ?? null,
          matched_terms: pub.nomePesquisado ? [pub.nomePesquisado] : null,
          partner_id: service.partner_id,
          partner_service_id: serviceId,
          raw_data: pub,
        });

        recordsSynced++;
      } catch (e) {
        console.error('Error processing publication:', e);
      }
    }

    // Update sync_log → success
    if (syncLogId) {
      await supabase.from('sync_logs').update({
        status: 'success',
        records_synced: recordsSynced + termsImported,
        completed_at: new Date().toISOString(),
      }).eq('id', syncLogId);
    }

    // Update last_sync_at on partner_services
    await supabase.from('partner_services')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', serviceId);

    console.log(`=== Sync complete: ${termsImported} terms imported, ${recordsSynced} new publications ===`);

    return new Response(JSON.stringify({
      success: true,
      terms_imported: termsImported,
      records_synced: recordsSynced,
      total_received: publications.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (syncLogId) {
      await supabase.from('sync_logs').update({
        status: 'error',
        error_message: message,
        completed_at: new Date().toISOString(),
      }).eq('id', syncLogId);
    }

    return new Response(
      JSON.stringify({ success: false, error: message, records_synced: 0 }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
