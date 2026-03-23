/**
 * API endpoint for processes - Full CRUD with client isolation, batch control, and bulk sub-resource endpoints
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

// ─── Helper: Get client's process IDs ───────────────────────────
async function getClientProcessIds(clientSystemId: string): Promise<string[]> {
  const { data } = await supabase
    .from('client_processes')
    .select('process_id')
    .eq('client_system_id', clientSystemId);
  return (data || []).map(cp => cp.process_id);
}

// ─── Helper: Get already-confirmed record IDs for a client ──────
async function getConfirmedIds(clientSystemId: string, recordType: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('record_confirmations')
    .select('record_id')
    .eq('client_system_id', clientSystemId)
    .eq('record_type', recordType);
  return new Set((data || []).map(r => r.record_id));
}

// ─── Helper: Confirm batch for a sub-resource ───────────────────
async function confirmSubResource(
  clientSystemId: string,
  serviceType: string,
  recordType: string,
  req: Request,
  rateLimitHeaders: Record<string, string>,
) {
  const { data: cursor } = await supabase
    .from('api_delivery_cursors')
    .select('*')
    .eq('client_system_id', clientSystemId)
    .eq('service_type', serviceType)
    .maybeSingle();

  if (!cursor || !cursor.pending_confirmation) {
    return jsonResponse({ error: `No pending ${recordType} batch to confirm` }, 400, rateLimitHeaders);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  // Get the IDs that were delivered in this batch from the cursor metadata
  const processIds = await getClientProcessIds(clientSystemId);
  if (processIds.length > 0) {
    const confirmedIds = await getConfirmedIds(clientSystemId, recordType);
    
    let tableName: string;
    let orderCol: string;
    switch (recordType) {
      case 'movements': tableName = 'process_movements'; orderCol = 'data_andamento'; break;
      case 'documents': tableName = 'process_documents'; orderCol = 'created_at'; break;
      case 'covers': tableName = 'process_covers'; orderCol = 'created_at'; break;
      case 'parties': tableName = 'process_parties'; orderCol = 'created_at'; break;
      default: tableName = 'process_movements'; orderCol = 'created_at';
    }

    const { data: records } = await supabase
      .from(tableName)
      .select('id')
      .in('process_id', processIds)
      .order(orderCol, { ascending: false })
      .limit(cursor.batch_size || 500);

    if (records && records.length > 0) {
      const newRecords = records.filter(r => !confirmedIds.has(r.id));
      if (newRecords.length > 0) {
        const confirmations = newRecords.map(r => ({
          record_id: r.id,
          record_type: recordType,
          client_system_id: clientSystemId,
          confirmed_at: new Date().toISOString(),
          ip_address: ip,
        }));
        await supabase
          .from('record_confirmations')
          .upsert(confirmations, { onConflict: 'record_id,record_type,client_system_id' });
      }
    }
  }

  await supabase
    .from('api_delivery_cursors')
    .update({ pending_confirmation: false, confirmed_at: new Date().toISOString() })
    .eq('id', cursor.id);

  return jsonResponse({
    message: `${recordType} batch confirmed successfully`,
    total_delivered: cursor.total_delivered,
  }, 200, rateLimitHeaders);
}

// ─── Helper: Bulk GET for a sub-resource ────────────────────────
async function bulkGetSubResource(
  clientSystemId: string,
  serviceType: string,
  recordType: string,
  limit: number,
  offset: number,
  rateLimitHeaders: Record<string, string>,
) {
  // Check pending confirmation
  const { data: cursor } = await supabase
    .from('api_delivery_cursors')
    .select('*')
    .eq('client_system_id', clientSystemId)
    .eq('service_type', serviceType)
    .maybeSingle();

  if (cursor?.pending_confirmation) {
    return jsonResponse({
      data: [],
      pagination: { total: 0, limit, offset, has_more: false },
      batch: {
        pending_confirmation: true,
        message: `Please confirm the previous ${recordType} batch before requesting new data. POST /api-processes?action=confirm_${recordType}`,
        total_delivered: cursor.total_delivered,
      },
    }, 200, rateLimitHeaders);
  }

  const processIds = await getClientProcessIds(clientSystemId);
  if (processIds.length === 0) {
    return jsonResponse({
      data: [],
      pagination: { total: 0, limit, offset, has_more: false },
    }, 200, rateLimitHeaders);
  }

  // Get already confirmed IDs to exclude
  const confirmedIds = await getConfirmedIds(clientSystemId, recordType);

  let tableName: string;
  let orderCol: string;
  switch (recordType) {
    case 'movements': tableName = 'process_movements'; orderCol = 'data_andamento'; break;
    case 'documents': tableName = 'process_documents'; orderCol = 'created_at'; break;
    case 'covers': tableName = 'process_covers'; orderCol = 'created_at'; break;
    case 'parties': tableName = 'process_parties'; orderCol = 'created_at'; break;
    default: tableName = 'process_movements'; orderCol = 'created_at';
  }

  // Fetch all records for these processes (we filter confirmed client-side due to Supabase limitations)
  const { data: allRecords, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .in('process_id', processIds)
    .order(orderCol, { ascending: false });

  if (error) throw error;

  // Filter out confirmed records
  const unconfirmed = (allRecords || []).filter(r => !confirmedIds.has(r.id));
  const total = unconfirmed.length;
  const paged = unconfirmed.slice(offset, offset + limit);

  // For parties, enrich with lawyers
  let result = paged;
  if (recordType === 'parties' && paged.length > 0) {
    const partyIds = paged.map(p => p.id);
    const { data: lawyers } = await supabase
      .from('process_lawyers')
      .select('*')
      .in('party_id', partyIds);
    result = paged.map(p => ({
      ...p,
      lawyers: (lawyers || []).filter(l => l.party_id === p.id),
    }));
  }

  // For covers, enrich with parties and lawyers
  if (recordType === 'covers' && paged.length > 0) {
    const coverProcessIds = [...new Set(paged.map(c => c.process_id).filter(Boolean))];
    if (coverProcessIds.length > 0) {
      const { data: parties } = await supabase
        .from('process_parties')
        .select('*')
        .in('process_id', coverProcessIds);
      const partyIds = (parties || []).map(p => p.id);
      const { data: lawyers } = partyIds.length > 0
        ? await supabase.from('process_lawyers').select('*').in('party_id', partyIds)
        : { data: [] };
      result = paged.map(c => ({
        ...c,
        parties: (parties || []).filter(p => p.process_id === c.process_id).map(p => ({
          ...p,
          lawyers: (lawyers || []).filter(l => l.party_id === p.id),
        })),
      }));
    }
  }

  // Update delivery cursor
  if (paged.length > 0) {
    const lastId = paged[paged.length - 1].id;
    await supabase.from('api_delivery_cursors').upsert({
      client_system_id: clientSystemId,
      service_type: serviceType,
      last_delivered_id: lastId,
      last_delivered_at: new Date().toISOString(),
      pending_confirmation: true,
      total_delivered: Math.min(offset + limit, total),
      batch_size: limit,
    }, { onConflict: 'client_system_id,service_type' });
  }

  return jsonResponse({
    data: result,
    pagination: { total, limit, offset, has_more: offset + limit < total },
    batch: paged.length > 0 ? {
      pending_confirmation: true,
      records_in_batch: paged.length,
      total_delivered: Math.min(offset + limit, total),
    } : undefined,
  }, 200, rateLimitHeaders);
}

// ─── Bulk action mapping ────────────────────────────────────────
const BULK_ACTIONS: Record<string, { serviceType: string; recordType: string }> = {
  movements: { serviceType: 'process_movements', recordType: 'movements' },
  documents: { serviceType: 'process_documents', recordType: 'documents' },
  covers: { serviceType: 'process_covers', recordType: 'covers' },
  parties: { serviceType: 'process_parties', recordType: 'parties' },
};

const CONFIRM_ACTIONS: Record<string, { serviceType: string; recordType: string }> = {
  confirm_movements: { serviceType: 'process_movements', recordType: 'movements' },
  confirm_documents: { serviceType: 'process_documents', recordType: 'documents' },
  confirm_covers: { serviceType: 'process_covers', recordType: 'covers' },
  confirm_parties: { serviceType: 'process_parties', recordType: 'parties' },
};

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

    // ─── POST: Confirm actions ──────────────────────────────────
    if (req.method === 'POST') {
      if (!action) {
        await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', 'POST', 405, Date.now() - startTime, req);
        return jsonResponse({ error: 'Method not allowed' }, 405, rateLimitHeaders);
      }

      if (!authResult.clientSystemId) {
        return jsonResponse({ error: 'Batch confirmation requires API token authentication' }, 400, rateLimitHeaders);
      }

      // Original confirm (processes list)
      if (action === 'confirm') {
        const { data: cursor } = await supabase
          .from('api_delivery_cursors')
          .select('*')
          .eq('client_system_id', authResult.clientSystemId)
          .eq('service_type', 'processes')
          .maybeSingle();

        if (!cursor || !cursor.pending_confirmation) {
          return jsonResponse({ error: 'No pending batch to confirm' }, 400, rateLimitHeaders);
        }

        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || req.headers.get('x-real-ip')
          || 'unknown';

        const { data: clientProcs } = await supabase
          .from('client_processes')
          .select('process_id')
          .eq('client_system_id', authResult.clientSystemId);

        if (clientProcs && clientProcs.length > 0) {
          const procIds = clientProcs.map(cp => cp.process_id);
          const { data: movements } = await supabase
            .from('process_movements')
            .select('id')
            .in('process_id', procIds)
            .order('data_andamento', { ascending: false })
            .limit(cursor.batch_size || 500);

          if (movements && movements.length > 0) {
            const confirmations = movements.map(m => ({
              record_id: m.id,
              record_type: 'movements',
              client_system_id: authResult.clientSystemId!,
              confirmed_at: new Date().toISOString(),
              ip_address: ip,
            }));
            await supabase
              .from('record_confirmations')
              .upsert(confirmations, { onConflict: 'record_id,record_type,client_system_id' });
          }
        }

        await supabase
          .from('api_delivery_cursors')
          .update({ pending_confirmation: false, confirmed_at: new Date().toISOString() })
          .eq('id', cursor.id);

        await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes/confirm', 'POST', 200, Date.now() - startTime, req);
        return jsonResponse({ message: 'Batch confirmed successfully', total_delivered: cursor.total_delivered }, 200, rateLimitHeaders);
      }

      // Sub-resource confirm actions
      const confirmDef = CONFIRM_ACTIONS[action];
      if (confirmDef) {
        const response = await confirmSubResource(
          authResult.clientSystemId,
          confirmDef.serviceType,
          confirmDef.recordType,
          req,
          rateLimitHeaders,
        );
        await logRequest(authResult.tokenId, authResult.clientSystemId, `/api-processes/${action}`, 'POST', 200, Date.now() - startTime, req);
        return response;
      }

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', 'POST', 400, Date.now() - startTime, req);
      return jsonResponse({ error: `Unknown action: ${action}` }, 400, rateLimitHeaders);
    }

    if (req.method !== 'GET') {
      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', req.method, 405, Date.now() - startTime, req);
      return jsonResponse({ error: 'Method not allowed' }, 405, rateLimitHeaders);
    }

    // ─── GET: Bulk sub-resource actions ─────────────────────────
    const bulkDef = action ? BULK_ACTIONS[action] : null;
    if (bulkDef) {
      if (!authResult.clientSystemId) {
        return jsonResponse({ error: 'Bulk endpoints require API token authentication' }, 400, rateLimitHeaders);
      }

      const params = sanitizeParams(url);
      if ('error' in params && typeof params.error === 'string') {
        return jsonResponse({ error: params.error }, 400, rateLimitHeaders);
      }
      const { limit, offset } = params as { limit: number; offset: number; id: string | null };

      const response = await bulkGetSubResource(
        authResult.clientSystemId,
        bulkDef.serviceType,
        bulkDef.recordType,
        limit,
        offset,
        rateLimitHeaders,
      );
      await logRequest(authResult.tokenId, authResult.clientSystemId, `/api-processes/${action}`, 'GET', 200, Date.now() - startTime, req);
      return response;
    }

    // ─── GET: Original process list / detail ────────────────────
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

      if (include) {
        const includes = include.split(',').map(s => s.trim());
        if (includes.includes('movements')) {
          const { data: movements } = await supabase.from('process_movements').select('*').eq('process_id', id).order('data_andamento', { ascending: false });
          result.movements = movements || [];
        }
        if (includes.includes('documents')) {
          const { data: documents } = await supabase.from('process_documents').select('*').eq('process_id', id).or('storage_path.not.is.null,documento_url.not.is.null');
          result.documents = documents || [];
        }
        if (includes.includes('parties')) {
          const { data: parties } = await supabase.from('process_parties').select('*').eq('process_id', id);
          if (parties) {
            const partyIds = parties.map(p => p.id);
            const { data: lawyers } = await supabase.from('process_lawyers').select('*').in('party_id', partyIds.length > 0 ? partyIds : ['none']);
            result.parties = parties.map(p => ({ ...p, lawyers: (lawyers || []).filter(l => l.party_id === p.id) }));
          }
        }
        if (includes.includes('cover')) {
          const { data: covers } = await supabase.from('process_covers').select('*').eq('process_id', id);
          result.covers = covers || [];
        }
        if (includes.includes('groupers')) {
          const { data: groupers } = await supabase.from('process_groupers').select('*').eq('process_id', id);
          result.groupers = groupers || [];
        }
      }

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', 'GET', 200, Date.now() - startTime, req);
      return jsonResponse({ data: result }, 200, rateLimitHeaders);
    }

    // GET list with client isolation
    let processIds: string[] | null = null;

    if (authResult.clientSystemId) {
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

      processIds = await getClientProcessIds(authResult.clientSystemId);

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
