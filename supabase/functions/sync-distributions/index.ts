/**
 * Sync Distributions Edge Function
 * Syncs new distributions from Solucionare WebAPI V3
 * Uses codEscritorio from partner to fetch all distributions at once
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { Logger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DistributionService {
  id: string;
  partner_id: string;
  service_name: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  is_active: boolean;
}

async function authenticateAPI(service: DistributionService): Promise<string> {
  const response = await fetch(`${service.service_url}/AutenticaAPI`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomeRelacional: service.nome_relacional, token: service.token }),
  });
  if (!response.ok) throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
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
    // Treat 400 "Não foi encontrado resultado" as empty result
    if (response.status === 400 && errorText.includes('encontrado resultado')) {
      return [];
    }
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }
  const contentType = response.headers.get('content-type');
  return contentType?.includes('application/json') ? await response.json() : await response.text();
}

async function getActiveServices(supabase: any): Promise<DistributionService[]> {
  const { data, error } = await supabase
    .from('partner_services')
    .select('*')
    .eq('service_type', 'distributions')
    .eq('is_active', true);
  if (error) throw error;
  return data || [];
}

async function getOfficeCode(supabase: any, serviceId: string, partnerId: string): Promise<number> {
  // Check service-specific config first
  const { data: serviceData } = await supabase
    .from('partner_services')
    .select('config')
    .eq('id', serviceId)
    .single();
  
  const serviceConfig = serviceData?.config as Record<string, any> | null;
  if (serviceConfig?.office_code) return serviceConfig.office_code;

  const { data, error } = await supabase
    .from('partners')
    .select('office_code')
    .eq('id', partnerId)
    .single();
  if (error) throw error;
  if (!data?.office_code) throw new Error('Parceiro não possui código de escritório configurado.');
  return data.office_code;
}

async function syncDistributions(
  supabase: any,
  service: DistributionService,
  jwtToken: string,
  officeCode: number
): Promise<number> {
  console.log(`Fetching distributions for office code: ${officeCode}`);

  const distributions = await apiRequest(
    service.service_url,
    `/BuscaNovasDistribuicoes?codEscritorio=${officeCode}`,
    jwtToken
  );

  if (!distributions || !Array.isArray(distributions) || distributions.length === 0) {
    console.log('No new distributions found');
    return 0;
  }

  let syncedCount = 0;

  for (const dist of distributions) {
    const processNumber = dist.numeroProcesso || dist.NumeroProcesso;
    if (!processNumber) continue;

    const { error: insertError } = await supabase
      .from('distributions')
      .upsert({
        process_number: processNumber,
        tribunal: dist.tribunal || dist.Tribunal || null,
        term: dist.nomePesquisado || dist.termo || dist.Termo || null,
        distribution_date: dist.dataDistribuicao || dist.DataDistribuicao || null,
        partner_service_id: service.id,
        partner_id: service.partner_id,
        raw_data: dist,
        // New detailed fields
        cod_processo: dist.codProcesso || null,
        cod_escritorio: dist.codEscritorio || null,
        instancia: dist.instancia || null,
        sigla_sistema: dist.siglaSistema || null,
        comarca: dist.comarca || null,
        orgao_julgador: dist.orgaoJulgador || null,
        tipo_do_processo: dist.tipoDoProcesso || null,
        data_audiencia: dist.dataAudiencia || null,
        tipo_audiencia: dist.tipoAudiencia || null,
        valor_da_causa: dist.valorDaCausa || null,
        assuntos: dist.assuntos || null,
        magistrado: dist.magistrado || null,
        autor: dist.autor || null,
        reu: dist.reu || null,
        outros_envolvidos: dist.outrosEnvolvidos || null,
        advogados: dist.advogados || null,
        movimentos: dist.movimentos || null,
        documentos_iniciais: dist.documentosIniciais || null,
        lista_documentos: dist.listaDocumentos || null,
        cidade: dist.cidade || null,
        uf: dist.uf || null,
        cod_pre_cadastro_termo: dist.codPreCadastroTermo || null,
        nome_pesquisado: dist.nomePesquisado || null,
        processo_originario: dist.processoOriginario || null,
      }, {
        onConflict: 'process_number,partner_service_id',
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.error('Error inserting distribution:', insertError);
    } else {
      syncedCount++;
    }
  }

  // Confirm receipt at Solucionare if service has confirm_receipt enabled
  if (syncedCount > 0) {
    // Check confirm_receipt flag
    const { data: svcData } = await supabase
      .from('partner_services')
      .select('confirm_receipt')
      .eq('id', service.id)
      .single();

    if (svcData?.confirm_receipt) {
      try {
        const confirmItems = distributions
          .filter((d: any) => d.codProcesso && (d.codEscritorio || officeCode))
          .map((d: any) => ({
            codEscritorio: d.codEscritorio || officeCode,
            codProcesso: d.codProcesso,
          }));

        if (confirmItems.length > 0) {
          console.log(`Confirming receipt for ${confirmItems.length} distributions...`);
          const batchSize = 100;
          for (let i = 0; i < confirmItems.length; i += batchSize) {
            const batch = confirmItems.slice(i, i + batchSize);
            await apiRequest(
              service.service_url,
              `/ConfirmaRecebimentoDistribuicoes?codEscritorio=${officeCode}`,
              jwtToken,
              'POST',
              { distribuicoes: batch }
            );
            console.log(`Confirmed batch ${Math.floor(i / batchSize) + 1}: ${batch.length} distributions`);
          }
        }
      } catch (confirmError) {
        console.error('Error confirming distribution receipt:', confirmError);
      }
    } else {
      console.log(`Skipping confirmation for ${distributions.length} distributions (confirm_receipt disabled)`);
    }
  }

  return syncedCount;
}

async function syncTermsFromDistributions(supabase: any, service: DistributionService, distributions: any[]) {
  // Extract unique terms from distributions
  const termsSet = new Set<string>();
  for (const dist of distributions) {
    const nome = dist.nomePesquisado;
    if (nome) termsSet.add(nome);
  }

  // Get entitled clients
  const { data: entitledClients } = await supabase
    .from('client_system_services')
    .select('client_system_id')
    .eq('partner_service_id', service.id)
    .eq('is_active', true);
  const clientIds = (entitledClients || []).map((c: any) => c.client_system_id);

  for (const termo of termsSet) {
    const { data: existing } = await supabase.from('search_terms')
      .select('id').eq('term', termo).eq('term_type', 'distribution')
      .eq('partner_service_id', service.id).maybeSingle();

    if (!existing) {
      const { data: inserted } = await supabase.from('search_terms').insert({
        term: termo, term_type: 'distribution',
        partner_service_id: service.id, partner_id: service.partner_id,
        is_active: true, solucionare_status: 'synced',
      }).select('id').single();

      if (inserted) {
        for (const clientId of clientIds) {
          await supabase.from('client_search_terms').upsert(
            { search_term_id: inserted.id, client_system_id: clientId },
            { onConflict: 'client_system_id,search_term_id' }
          );
        }
      }
    }
  }
}

async function updateLastSync(supabase: any, serviceId: string): Promise<void> {
  await supabase
    .from('partner_services')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', serviceId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const services = await getActiveServices(supabase);

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active distribution services found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const results = [];

    for (const service of services) {
      try {
        await logger.start({ partner_service_id: service.id, sync_type: 'distributions' });

        const jwtToken = await authenticateAPI(service);
        const officeCode = await getOfficeCode(supabase, service.id, service.partner_id);
        const syncedCount = await syncDistributions(supabase, service, jwtToken, officeCode);

        await updateLastSync(supabase, service.id);
        await logger.success(syncedCount);

        results.push({ service: service.service_name, success: true, recordsSynced: syncedCount });
      } catch (error) {
        console.error(`Error syncing service ${service.service_name}:`, error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await logger.error(errorMsg);
        results.push({ service: service.service_name, success: false, error: errorMsg });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Sync distributions error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
