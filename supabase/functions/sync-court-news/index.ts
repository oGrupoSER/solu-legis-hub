/**
 * Sync Court News Edge Function
 * Syncs tribunal status news from Solucionare WebAPI
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { Logger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface NewsService {
  id: string;
  partner_id: string;
  service_name: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  is_active: boolean;
  last_sync_at: string | null;
}

interface CourtNews {
  codNoticia: number;
  codMapaDiario: number;
  codAssunto: number;
  tribunal: string;
  estado: string;
  siglaDiario: string;
  assunto: string;
  titulo: string;
  descricao: string;
  dataPublicacao: string;
  dataDisponibilizacao: string;
}

/**
 * Get active court news services
 */
async function getActiveServices(supabase: any): Promise<NewsService[]> {
  const { data, error } = await supabase
    .from('partner_services')
    .select('*')
    .eq('service_type', 'court_news')
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

/**
 * Fetch news from Solucionare API
 */
async function fetchNews(service: NewsService, lastSyncDate?: string): Promise<CourtNews[]> {
  const params = new URLSearchParams({
    nomeRelacional: service.nome_relacional,
    token: service.token,
  });

  if (lastSyncDate) {
    params.append('dataInicial', lastSyncDate);
  }

  const url = `${service.service_url}/getNoticias?${params.toString()}`;
  console.log(`Fetching news from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (Array.isArray(data)) {
    return data;
  }
  
  if (data.noticias && Array.isArray(data.noticias)) {
    return data.noticias;
  }

  console.log('No news array found in response');
  return [];
}

/**
 * Fetch available subjects/categories
 */
async function fetchSubjects(service: NewsService): Promise<any[]> {
  const params = new URLSearchParams({
    nomeRelacional: service.nome_relacional,
    token: service.token,
  });

  const url = `${service.service_url}/getAssuntos?${params.toString()}`;
  console.log(`Fetching subjects from: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch subjects: ${response.status}`);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return [];
  }
}

/**
 * Sync news to database
 */
async function syncNews(
  supabase: any,
  service: NewsService,
  news: CourtNews[]
): Promise<number> {
  let syncedCount = 0;

  for (const item of news) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('court_news')
      .select('id')
      .eq('cod_noticia', item.codNoticia)
      .maybeSingle();

    if (existing) {
      console.log(`News ${item.codNoticia} already exists, skipping`);
      continue;
    }

    const { error } = await supabase.from('court_news').insert({
      cod_noticia: item.codNoticia,
      cod_mapa_diario: item.codMapaDiario,
      cod_assunto: item.codAssunto,
      tribunal: item.tribunal,
      estado: item.estado,
      sigla_diario: item.siglaDiario,
      assunto: item.assunto,
      titulo: item.titulo,
      descricao: item.descricao,
      data_publicacao: item.dataPublicacao ? new Date(item.dataPublicacao).toISOString() : null,
      data_disponibilizacao: item.dataDisponibilizacao ? new Date(item.dataDisponibilizacao).toISOString() : null,
      partner_service_id: service.id,
      raw_data: item,
    });

    if (error) {
      console.error(`Error inserting news ${item.codNoticia}:`, error);
    } else {
      syncedCount++;
    }
  }

  return syncedCount;
}

/**
 * Update last sync timestamp
 */
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
    // Check for action parameter
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        // No body, use defaults
      }
    }

    const { action, serviceId } = body;

    // Handle specific actions
    if (action === 'getSubjects' && serviceId) {
      const { data: service, error } = await supabase
        .from('partner_services')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (error) throw error;

      const subjects = await fetchSubjects(service);
      return new Response(
        JSON.stringify({ success: true, data: subjects }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Default: sync all news
    const services = await getActiveServices(supabase);

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active court news services found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const results = [];

    for (const service of services) {
      try {
        await logger.start({
          partner_service_id: service.id,
          sync_type: 'court_news',
        });

        // Get last sync date for incremental sync
        const lastSyncDate = service.last_sync_at
          ? new Date(service.last_sync_at).toISOString().split('T')[0]
          : undefined;

        console.log(`Syncing court news for service ${service.service_name}, last sync: ${lastSyncDate || 'never'}`);

        const news = await fetchNews(service, lastSyncDate);
        console.log(`Fetched ${news.length} news items`);

        const syncedCount = await syncNews(supabase, service, news);

        await updateLastSync(supabase, service.id);
        await logger.success(syncedCount);

        results.push({
          service: service.service_name,
          success: true,
          fetched: news.length,
          synced: syncedCount,
        });

      } catch (error) {
        console.error(`Error syncing service ${service.service_name}:`, error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await logger.error(errorMsg);

        results.push({
          service: service.service_name,
          success: false,
          error: errorMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Sync court news error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
