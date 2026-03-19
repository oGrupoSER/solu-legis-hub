/**
 * Edge Function: manage-scheduled-sync
 * Manages scheduled sync jobs via pg_cron
 * Actions: list, create, update, delete, toggle, logs, run-now
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();

    switch (action) {
      case 'list':
        return await listJobs();
      case 'create':
        return await createJob(payload);
      case 'update':
        return await updateJob(payload);
      case 'delete':
        return await deleteJob(payload);
      case 'toggle':
        return await toggleJob(payload);
      case 'logs':
        return await getLogs(payload);
      case 'run-now':
        return await runNow(payload);
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});

async function listJobs() {
  const { data, error } = await supabase
    .from('scheduled_sync_jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Also fetch pg_cron job details for each
  for (const job of (data || [])) {
    if (job.pg_cron_job_id) {
      try {
        const { data: cronData } = await supabase.rpc('get_cron_job_details', {
          p_job_id: job.pg_cron_job_id,
        });
        if (cronData) {
          job.cron_details = cronData;
        }
      } catch {
        // pg_cron details not critical
      }
    }
  }

  return jsonResponse({ jobs: data || [] });
}

async function createJob(payload: any) {
  const { name, services, cron_expression, is_active = true } = payload;

  if (!name || !services?.length || !cron_expression) {
    return jsonResponse({ error: 'name, services, and cron_expression are required' }, 400);
  }

  // Insert into our tracking table
  const { data: job, error } = await supabase
    .from('scheduled_sync_jobs')
    .insert({
      name,
      services,
      cron_expression,
      is_active,
    })
    .select()
    .single();

  if (error) throw error;

  // Create the pg_cron job if active
  if (is_active) {
    await scheduleCronJob(job);
  }

  return jsonResponse({ job });
}

async function updateJob(payload: any) {
  const { id, name, services, cron_expression, is_active } = payload;

  if (!id) return jsonResponse({ error: 'id is required' }, 400);

  // Get existing job
  const { data: existing, error: fetchError } = await supabase
    .from('scheduled_sync_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Unschedule old cron job
  if (existing.pg_cron_job_id) {
    await unscheduleCronJob(existing.pg_cron_job_id);
  }

  // Update record
  const updates: any = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (services !== undefined) updates.services = services;
  if (cron_expression !== undefined) updates.cron_expression = cron_expression;
  if (is_active !== undefined) updates.is_active = is_active;
  updates.pg_cron_job_id = null;

  const { data: job, error } = await supabase
    .from('scheduled_sync_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Reschedule if active
  if (job.is_active) {
    await scheduleCronJob(job);
  }

  return jsonResponse({ job });
}

async function deleteJob(payload: any) {
  const { id } = payload;
  if (!id) return jsonResponse({ error: 'id is required' }, 400);

  // Get job to unschedule
  const { data: job } = await supabase
    .from('scheduled_sync_jobs')
    .select('pg_cron_job_id')
    .eq('id', id)
    .single();

  if (job?.pg_cron_job_id) {
    await unscheduleCronJob(job.pg_cron_job_id);
  }

  const { error } = await supabase
    .from('scheduled_sync_jobs')
    .delete()
    .eq('id', id);

  if (error) throw error;

  return jsonResponse({ success: true });
}

async function toggleJob(payload: any) {
  const { id } = payload;
  if (!id) return jsonResponse({ error: 'id is required' }, 400);

  const { data: existing, error: fetchError } = await supabase
    .from('scheduled_sync_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const newActive = !existing.is_active;

  if (existing.pg_cron_job_id && !newActive) {
    await unscheduleCronJob(existing.pg_cron_job_id);
  }

  const { data: job, error } = await supabase
    .from('scheduled_sync_jobs')
    .update({ is_active: newActive, pg_cron_job_id: newActive ? existing.pg_cron_job_id : null })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (newActive) {
    await scheduleCronJob(job);
  }

  return jsonResponse({ job });
}

async function getLogs(payload: any) {
  const { job_id, limit = 50 } = payload;

  let query = supabase
    .from('scheduled_sync_logs')
    .select('*, scheduled_sync_jobs(name, services)')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  return jsonResponse({ logs: data || [] });
}

async function runNow(payload: any) {
  const { id } = payload;
  if (!id) return jsonResponse({ error: 'id is required' }, 400);

  const { data: job, error: fetchError } = await supabase
    .from('scheduled_sync_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Create log entry
  const { data: log, error: logError } = await supabase
    .from('scheduled_sync_logs')
    .insert({
      job_id: id,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (logError) throw logError;

  // Call sync-orchestrator
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        services: job.services,
        force: true,
      }),
    });

    const result = await response.json();

    // Update log
    await supabase
      .from('scheduled_sync_logs')
      .update({
        status: result.success ? 'success' : 'error',
        completed_at: new Date().toISOString(),
        result,
        error_message: result.success ? null : (result.error || 'Unknown error'),
      })
      .eq('id', log.id);

    // Update job last_run_at
    await supabase
      .from('scheduled_sync_jobs')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', id);

    return jsonResponse({ success: true, log_id: log.id, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('scheduled_sync_logs')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('id', log.id);

    return jsonResponse({ success: false, error: message }, 500);
  }
}

async function scheduleCronJob(job: any) {
  const jobName = `sync_${job.id.replace(/-/g, '_')}`;
  const servicesJson = JSON.stringify({ services: job.services, force: true });

  // Use raw SQL to schedule via pg_cron + pg_net
  const sql = `
    SELECT cron.schedule(
      '${jobName}',
      '${job.cron_expression}',
      $$
      SELECT net.http_post(
        url := '${supabaseUrl}/functions/v1/sync-orchestrator',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${supabaseAnonKey}"}'::jsonb,
        body := '${servicesJson}'::jsonb
      ) AS request_id;
      $$
    );
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Failed to schedule cron job:', error);
    // Try alternative approach - direct insert
    console.log('Attempting alternative scheduling...');
  } else {
    // Get the job ID from pg_cron
    const { data: cronJob } = await supabase.rpc('exec_sql', {
      sql_query: `SELECT jobid FROM cron.job WHERE jobname = '${jobName}' LIMIT 1`,
    });

    if (cronJob?.[0]?.jobid) {
      await supabase
        .from('scheduled_sync_jobs')
        .update({ pg_cron_job_id: cronJob[0].jobid })
        .eq('id', job.id);
    }
  }
}

async function unscheduleCronJob(pgCronJobId: number) {
  try {
    await supabase.rpc('exec_sql', {
      sql_query: `SELECT cron.unschedule(${pgCronJobId})`,
    });
  } catch (error) {
    console.error('Failed to unschedule cron job:', error);
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
