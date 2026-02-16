/**
 * API endpoint for processes - Full CRUD with client isolation and batch control
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { validateToken, logRequest, buildRateLimitHeaders, sanitizeParams } from '../_shared/auth-middleware.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: any, status: number, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

serve(async (req) => {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await validateToken(req, 'processes');

    if (!authResult.authenticated) {
      await logRequest(undefined, undefined, '/api-processes', req.method, 401, Date.now() - startTime, req);
      const headers = authResult.rateLimitInfo ? buildRateLimitHeaders(authResult) : {};
      return jsonResponse({ error: authResult.error }, 401, headers);
    }

    const rateLimitHeaders = buildRateLimitHeaders(authResult);
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // POST /api-processes?action=confirm - Confirm batch receipt
    if (req.method === 'POST' && action === 'confirm') {
      if (!authResult.clientSystemId) {
        return jsonResponse({ error: 'Batch confirmation requires API token authentication' }, 400, rateLimitHeaders);
      }

      const { data: cursor } = await supabase
        .from('api_delivery_cursors')
        .select('*')
        .eq('client_system_id', authResult.clientSystemId)
        .eq('service_type', 'processes')
        .maybeSingle();

      if (!cursor || !cursor.pending_confirmation) {
        return jsonResponse({ error: 'No pending batch to confirm' }, 400, rateLimitHeaders);
      }

      await supabase
        .from('api_delivery_cursors')
        .update({ pending_confirmation: false, confirmed_at: new Date().toISOString() })
        .eq('id', cursor.id);

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes/confirm', 'POST', 200, Date.now() - startTime, req);
      return jsonResponse({ message: 'Batch confirmed successfully', total_delivered: cursor.total_delivered }, 200, rateLimitHeaders);
    }

    if (req.method !== 'GET') {
      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', req.method, 405, Date.now() - startTime, req);
      return jsonResponse({ error: 'Method not allowed' }, 405, rateLimitHeaders);
    }

    // Validate params
    const params = sanitizeParams(url);
    if ('error' in params && typeof params.error === 'string') {
      return jsonResponse({ error: params.error }, 400, rateLimitHeaders);
    }

    const { limit, offset, id } = params as { limit: number; offset: number; id: string | null };
    const include = url.searchParams.get('include');
    const numero = url.searchParams.get('numero');
    const tribunal = url.searchParams.get('tribunal');
    const instancia = url.searchParams.get('instancia');
    const status = url.searchParams.get('status');
    const uf = url.searchParams.get('uf');

    // GET single process by id
    if (id) {
      let query = supabase.from('processes').select('*');

      // Client isolation
      if (authResult.clientSystemId) {
        const { data: linked } = await supabase
          .from('client_processes')
          .select('process_id')
          .eq('client_system_id', authResult.clientSystemId)
          .eq('process_id', id);
        if (!linked || linked.length === 0) {
          return jsonResponse({ error: 'Process not found or not linked to your account' }, 404, rateLimitHeaders);
        }
      }

      const { data: process, error } = await query.eq('id', id).maybeSingle();
      if (error) throw error;
      if (!process) return jsonResponse({ error: 'Process not found' }, 404, rateLimitHeaders);

      let result: any = { ...process };

      // Include sub-resources
      if (include) {
        const includes = include.split(',').map(s => s.trim());

        if (includes.includes('movements')) {
          const { data: movements } = await supabase
            .from('process_movements')
            .select('*')
            .eq('process_id', id)
            .order('data_andamento', { ascending: false });
          result.movements = movements || [];
        }
        if (includes.includes('documents')) {
          const { data: documents } = await supabase
            .from('process_documents')
            .select('*')
            .eq('process_id', id)
            .not('storage_path', 'is', null);
          result.documents = documents || [];
        }
        if (includes.includes('parties')) {
          const { data: parties } = await supabase
            .from('process_parties')
            .select('*')
            .eq('process_id', id);
          if (parties) {
            const partyIds = parties.map(p => p.id);
            const { data: lawyers } = await supabase
              .from('process_lawyers')
              .select('*')
              .in('party_id', partyIds.length > 0 ? partyIds : ['none']);
            result.parties = parties.map(p => ({
              ...p,
              lawyers: (lawyers || []).filter(l => l.party_id === p.id),
            }));
          }
        }
        if (includes.includes('cover')) {
          const { data: covers } = await supabase
            .from('process_covers')
            .select('*')
            .eq('process_id', id);
          result.covers = covers || [];
        }
        if (includes.includes('groupers')) {
          const { data: groupers } = await supabase
            .from('process_groupers')
            .select('*')
            .eq('process_id', id);
          result.groupers = groupers || [];
        }
      }

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', 'GET', 200, Date.now() - startTime, req);
      return jsonResponse({ data: result }, 200, rateLimitHeaders);
    }

    // GET list with client isolation
    let processIds: string[] | null = null;

    if (authResult.clientSystemId) {
      // Check for pending batch
      const { data: cursor } = await supabase
        .from('api_delivery_cursors')
        .select('*')
        .eq('client_system_id', authResult.clientSystemId)
        .eq('service_type', 'processes')
        .maybeSingle();

      if (cursor?.pending_confirmation) {
        await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', 'GET', 200, Date.now() - startTime, req);
        return jsonResponse({
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
          batch: {
            pending_confirmation: true,
            message: 'Please confirm the previous batch before requesting new data. POST /api-processes?action=confirm',
            total_delivered: cursor.total_delivered,
          },
          rate_limit: authResult.rateLimitInfo,
        }, 200, rateLimitHeaders);
      }

      const { data: clientProcesses } = await supabase
        .from('client_processes')
        .select('process_id')
        .eq('client_system_id', authResult.clientSystemId);
      processIds = (clientProcesses || []).map(cp => cp.process_id);

      if (processIds.length === 0) {
        await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', 'GET', 200, Date.now() - startTime, req);
        return jsonResponse({
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
          rate_limit: authResult.rateLimitInfo,
        }, 200, rateLimitHeaders);
      }
    }

    let query = supabase.from('processes').select('*', { count: 'exact' });

    if (processIds) query = query.in('id', processIds);
    if (numero) query = query.eq('process_number', numero);
    if (tribunal) query = query.eq('tribunal', tribunal);
    if (instancia) query = query.eq('instance', instancia);
    if (status) query = query.eq('status', status);
    if (uf) query = query.eq('uf', uf);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: processes, error, count } = await query;
    if (error) throw error;

    const total = count || 0;

    // Update delivery cursor for client tokens
    if (authResult.clientSystemId && processes && processes.length > 0) {
      const lastId = processes[processes.length - 1].id;
      await supabase.from('api_delivery_cursors').upsert({
        client_system_id: authResult.clientSystemId,
        service_type: 'processes',
        last_delivered_id: lastId,
        last_delivered_at: new Date().toISOString(),
        pending_confirmation: true,
        total_delivered: (total > 0 ? Math.min(offset + limit, total) : 0),
        batch_size: limit,
      }, { onConflict: 'client_system_id,service_type' });
    }

    await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', 'GET', 200, Date.now() - startTime, req);

    return jsonResponse({
      data: processes,
      pagination: { total, limit, offset, has_more: offset + limit < total },
      batch: authResult.clientSystemId ? {
        pending_confirmation: (processes?.length || 0) > 0,
        records_in_batch: processes?.length || 0,
        total_delivered: Math.min(offset + limit, total),
      } : undefined,
      rate_limit: authResult.rateLimitInfo,
    }, 200, rateLimitHeaders);

  } catch (error) {
    console.error('Error in api-processes:', error);
    await logRequest(undefined, undefined, '/api-processes', req.method, 500, Date.now() - startTime, req);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
