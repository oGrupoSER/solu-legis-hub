/**
 * Edge Function: sync-orchestrator
 * Orchestrates all synchronization operations
 * Can be invoked manually or scheduled via cron
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorRequest {
  services?: string[]; // Array of service types to sync: ['processes', 'distributions', 'publications']
  service_ids?: string[]; // Specific service IDs to sync
  force?: boolean; // Force sync even if recently synced
  parallel?: boolean; // Run syncs in parallel (default: true)
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      services = ['processes', 'distributions', 'publications'],
      service_ids,
      force = false,
      parallel = true,
    }: OrchestratorRequest = await req.json();

    console.log('Starting sync orchestration...');
    console.log(`Services to sync: ${services.join(', ')}`);
    console.log(`Parallel mode: ${parallel}`);
    console.log(`Force sync: ${force}`);

    const results = {
      processes: null as any,
      distributions: null as any,
      publications: null as any,
      errors: [] as string[],
    };

    // Get active services to sync
    let activeServices;
    if (service_ids && service_ids.length > 0) {
      const { data, error } = await supabase
        .from('partner_services')
        .select('*')
        .in('id', service_ids)
        .eq('is_active', true);

      if (error) throw error;
      activeServices = data || [];
    } else {
      const { data, error } = await supabase
        .from('partner_services')
        .select('*')
        .in('service_type', services)
        .eq('is_active', true);

      if (error) throw error;
      activeServices = data || [];
    }

    if (activeServices.length === 0) {
      throw new Error('No active services found to sync');
    }

    console.log(`Found ${activeServices.length} active services`);

    // Check if services need syncing (unless forced)
    if (!force) {
      const now = new Date();
      const minSyncInterval = 5 * 60 * 1000; // 5 minutes

      activeServices = activeServices.filter((service: any) => {
        if (!service.last_sync_at) return true;
        
        const lastSync = new Date(service.last_sync_at);
        const timeSinceSync = now.getTime() - lastSync.getTime();
        
        return timeSinceSync >= minSyncInterval;
      });

      console.log(`${activeServices.length} services need syncing`);
    }

    // Group services by type
    const servicesByType = {
      processes: activeServices.filter((s: any) => s.service_type === 'processes'),
      distributions: activeServices.filter((s: any) => s.service_type === 'distributions'),
      publications: activeServices.filter((s: any) => s.service_type === 'publications'),
    };

    // Sync processes and distributions in parallel
    if (parallel && (services.includes('processes') || services.includes('distributions'))) {
      const parallelTasks = [];

      if (services.includes('processes') && servicesByType.processes.length > 0) {
        parallelTasks.push(
          invokeFunction('sync-processes', {
            force,
            service_ids: servicesByType.processes.map((s: any) => s.id),
          }).then((result) => {
            results.processes = result;
          }).catch((error) => {
            results.errors.push(`Processes sync error: ${error.message}`);
          })
        );
      }

      if (services.includes('distributions') && servicesByType.distributions.length > 0) {
        parallelTasks.push(
          invokeFunction('sync-distributions', {
            force,
            service_ids: servicesByType.distributions.map((s: any) => s.id),
          }).then((result) => {
            results.distributions = result;
          }).catch((error) => {
            results.errors.push(`Distributions sync error: ${error.message}`);
          })
        );
      }

      await Promise.allSettled(parallelTasks);
    } else {
      // Sequential sync
      if (services.includes('processes') && servicesByType.processes.length > 0) {
        try {
          results.processes = await invokeFunction('sync-processes', {
            force,
            service_ids: servicesByType.processes.map((s: any) => s.id),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`Processes sync error: ${message}`);
        }
      }

      if (services.includes('distributions') && servicesByType.distributions.length > 0) {
        try {
          results.distributions = await invokeFunction('sync-distributions', {
            force,
            service_ids: servicesByType.distributions.map((s: any) => s.id),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`Distributions sync error: ${message}`);
        }
      }
    }

    // Sync publications (always after terms are ready)
    if (services.includes('publications') && servicesByType.publications.length > 0) {
      try {
        results.publications = await invokeFunction('sync-publications', {
          force,
          service_ids: servicesByType.publications.map((s: any) => s.id),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Publications sync error: ${message}`);
      }
    }

    // Calculate summary
    const summary = {
      total_services: activeServices.length,
      synced_services: Object.values(results).filter((r) => r !== null).length,
      total_errors: results.errors.length,
      processes_synced: results.processes?.results?.reduce((sum: number, r: any) => sum + (r.synced || 0), 0) || 0,
      distributions_synced: results.distributions?.results?.reduce((sum: number, r: any) => sum + (r.synced || 0), 0) || 0,
      publications_synced: results.publications?.results?.reduce((sum: number, r: any) => sum + (r.synced || 0), 0) || 0,
    };

    console.log('Orchestration completed');
    console.log('Summary:', summary);

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        summary,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Orchestration failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Invoke an Edge Function
 */
async function invokeFunction(functionName: string, body: any): Promise<any> {
  console.log(`Invoking function: ${functionName}`);

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Function ${functionName} failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log(`Function ${functionName} completed`);

  return result;
}
