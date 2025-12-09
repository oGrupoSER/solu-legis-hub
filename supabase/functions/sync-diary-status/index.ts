/**
 * Sync Diary Status Edge Function
 * Fetches tribunal diary availability status from Solucionare statusDiarios API
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

interface DiaryService {
  id: string;
  partner_id: string;
  service_name: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  is_active: boolean;
  config: {
    tipoDataFiltro?: number;
  };
}

interface DiaryStatusItem {
  codMapaDiario: number;
  nomeDiario: string;
  siglaDiario: string;
  esferaDiario: string;
  tribunal: string;
  estado: string;
  dataPublicacao: string;
  dataDisponibilizacao: string;
  status?: string;
}

/**
 * Get current date formatted as yyyy-MM-dd
 */
function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get active diary status services
 */
async function getActiveServices(supabase: any): Promise<DiaryService[]> {
  console.log('Fetching active diary_status services...');
  
  const { data, error } = await supabase
    .from('partner_services')
    .select('*')
    .eq('service_type', 'diary_status')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching services:', error);
    throw error;
  }
  
  console.log(`Found ${data?.length || 0} active diary_status services`);
  return data || [];
}

/**
 * Fetch diary status from Solucionare API
 */
async function fetchDiaryStatus(service: DiaryService): Promise<DiaryStatusItem[]> {
  const tipoDataFiltro = service.config?.tipoDataFiltro || 1;
  const currentDate = getCurrentDate();

  const params = new URLSearchParams({
    nomeRelacional: service.nome_relacional,
    token: service.token,
    data: currentDate,
    tipoDataFiltro: String(tipoDataFiltro),
  });

  const url = `${service.service_url}?${params.toString()}`;
  console.log(`Fetching diary status from: ${service.service_url}`);
  console.log(`Parameters: data=${currentDate}, tipoDataFiltro=${tipoDataFiltro}`);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Error: ${response.status} - ${errorText}`);
    throw new Error(`Failed to fetch diary status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`Received response with ${Array.isArray(data) ? data.length : 'unknown'} items`);

  // Handle different response formats
  if (Array.isArray(data)) {
    return data;
  }

  if (data.diarios && Array.isArray(data.diarios)) {
    return data.diarios;
  }

  if (data.statusDiarios && Array.isArray(data.statusDiarios)) {
    return data.statusDiarios;
  }

  console.log('Response structure:', Object.keys(data));
  return [];
}

/**
 * Determine status based on data
 */
function determineStatus(item: DiaryStatusItem): string {
  // If API provides status, use it
  if (item.status) {
    return item.status.toLowerCase();
  }

  // Determine based on publication date
  const today = getCurrentDate();
  
  if (item.dataPublicacao) {
    // Parse date and compare
    const pubDate = item.dataPublicacao.split('T')[0];
    if (pubDate === today) {
      return 'disponivel';
    }
    // If publication date is in the past, might be unavailable for today
    return 'pendente';
  }

  return 'pendente';
}

/**
 * Sync diary status to database
 */
async function syncDiaryStatus(
  supabase: any,
  service: DiaryService,
  items: DiaryStatusItem[]
): Promise<number> {
  const currentDate = getCurrentDate();
  let syncedCount = 0;

  console.log(`Syncing ${items.length} diary status items for date ${currentDate}`);

  for (const item of items) {
    try {
      const status = determineStatus(item);

      const record = {
        partner_service_id: service.id,
        consulta_date: currentDate,
        cod_mapa_diario: item.codMapaDiario,
        nome_diario: item.nomeDiario || null,
        sigla_diario: item.siglaDiario || null,
        esfera_diario: item.esferaDiario || null,
        tribunal: item.tribunal || null,
        estado: item.estado || null,
        data_publicacao: item.dataPublicacao ? item.dataPublicacao.split('T')[0] : null,
        data_disponibilizacao: item.dataDisponibilizacao || null,
        status: status,
        raw_data: item,
      };

      // Upsert - update if exists for same service/diario/date
      const { error } = await supabase
        .from('diary_status')
        .upsert(record, {
          onConflict: 'partner_service_id,cod_mapa_diario,consulta_date',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`Error upserting diary ${item.codMapaDiario}:`, error);
      } else {
        syncedCount++;
      }
    } catch (err) {
      console.error(`Error processing item ${item.codMapaDiario}:`, err);
    }
  }

  console.log(`Successfully synced ${syncedCount}/${items.length} diary status items`);
  return syncedCount;
}

/**
 * Update last sync timestamp for service
 */
async function updateLastSync(supabase: any, serviceId: string): Promise<void> {
  const { error } = await supabase
    .from('partner_services')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', serviceId);

  if (error) {
    console.error('Error updating last_sync_at:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logger = new Logger();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Starting diary status sync...');

    const services = await getActiveServices(supabase);

    if (services.length === 0) {
      console.log('No active diary_status services found');
      return new Response(
        JSON.stringify({ 
          message: 'No active diary status services found',
          results: [] 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const results = [];

    for (const service of services) {
      try {
        console.log(`\n=== Processing service: ${service.service_name} ===`);
        
        await logger.start({
          partner_service_id: service.id,
          sync_type: 'diary_status',
        });

        const items = await fetchDiaryStatus(service);
        console.log(`Fetched ${items.length} diary status items`);

        const syncedCount = await syncDiaryStatus(supabase, service, items);

        await updateLastSync(supabase, service.id);
        await logger.success(syncedCount);

        results.push({
          service: service.service_name,
          success: true,
          fetched: items.length,
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

    console.log('\n=== Sync completed ===');
    console.log('Results:', JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true,
        date: getCurrentDate(),
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Sync diary status error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMsg 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
