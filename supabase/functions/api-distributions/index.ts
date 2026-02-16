/**
 * API endpoint for distributions - with client isolation and batch control
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

/**
 * Get the list of terms linked to a client via client_search_terms
 */
async function getClientTerms(clientSystemId: string): Promise<string[]> {
  const { data: clientTermLinks } = await supabase
    .from('client_search_terms')
    .select('search_term_id')
    .eq('client_system_id', clientSystemId);

  if (!clientTermLinks || clientTermLinks.length === 0) return [];

  const termIds = clientTermLinks.map(ct => ct.search_term_id);
  const { data: terms } = await supabase
    .from('search_terms')
    .select('term')
    .in('id', termIds)
    .in('term_type', ['distributions', 'name', 'office']);

  return (terms || []).map(t => t.term);
}

serve(async (req) => {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await validateToken(req, 'distributions');

    if (!authResult.authenticated) {
      await logRequest(undefined, undefined, '/api-distributions', req.method, 401, Date.now() - startTime, req);
      return jsonResponse({ error: authResult.error }, 401);
    }

    const rateLimitHeaders = buildRateLimitHeaders(authResult);
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // POST confirm
    if (req.method === 'POST' && action === 'confirm') {
      if (!authResult.clientSystemId) {
        return jsonResponse({ error: 'Batch confirmation requires API token authentication' }, 400, rateLimitHeaders);
      }

      const { data: cursor } = await supabase
        .from('api_delivery_cursors')
        .select('*')
        .eq('client_system_id', authResult.clientSystemId)
        .eq('service_type', 'distributions')
        .maybeSingle();

      if (!cursor || !cursor.pending_confirmation) {
        return jsonResponse({ error: 'No pending batch to confirm' }, 400, rateLimitHeaders);
      }

      await supabase
        .from('api_delivery_cursors')
        .update({ pending_confirmation: false, confirmed_at: new Date().toISOString() })
        .eq('id', cursor.id);

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-distributions/confirm', 'POST', 200, Date.now() - startTime, req);
      return jsonResponse({ message: 'Batch confirmed successfully', total_delivered: cursor.total_delivered }, 200, rateLimitHeaders);
    }

    if (req.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405, rateLimitHeaders);
    }

    const params = sanitizeParams(url);
    if ('error' in params && typeof params.error === 'string') {
      return jsonResponse({ error: params.error }, 400, rateLimitHeaders);
    }

    const { limit, offset, id, dataInicial, dataFinal } = params as any;
    const termo = url.searchParams.get('termo');
    const tribunal = url.searchParams.get('tribunal');

    // Single distribution by id
    if (id) {
      const { data: dist, error } = await supabase.from('distributions').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!dist) return jsonResponse({ error: 'Distribution not found' }, 404, rateLimitHeaders);

      // Client isolation check
      if (authResult.clientSystemId) {
        const clientTerms = await getClientTerms(authResult.clientSystemId);
        if (clientTerms.length > 0 && dist.term && !clientTerms.includes(dist.term)) {
          return jsonResponse({ error: 'Distribution not found or not linked to your account' }, 404, rateLimitHeaders);
        }
      }

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-distributions', 'GET', 200, Date.now() - startTime, req);
      return jsonResponse({ data: dist }, 200, rateLimitHeaders);
    }

    // Check pending batch
    if (authResult.clientSystemId) {
      const { data: cursor } = await supabase
        .from('api_delivery_cursors')
        .select('*')
        .eq('client_system_id', authResult.clientSystemId)
        .eq('service_type', 'distributions')
        .maybeSingle();

      if (cursor?.pending_confirmation) {
        await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-distributions', 'GET', 200, Date.now() - startTime, req);
        return jsonResponse({
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
          batch: {
            pending_confirmation: true,
            message: 'Please confirm the previous batch before requesting new data. POST /api-distributions?action=confirm',
            total_delivered: cursor.total_delivered,
          },
          rate_limit: authResult.rateLimitInfo,
        }, 200, rateLimitHeaders);
      }
    }

    // Build query with client isolation via terms
    let query = supabase.from('distributions').select('*', { count: 'exact' });

    if (authResult.clientSystemId) {
      const clientTerms = await getClientTerms(authResult.clientSystemId);
      if (clientTerms.length === 0) {
        await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-distributions', 'GET', 200, Date.now() - startTime, req);
        return jsonResponse({
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
          rate_limit: authResult.rateLimitInfo,
        }, 200, rateLimitHeaders);
      }
      query = query.in('term', clientTerms);
    }

    if (termo) query = query.eq('term', termo);
    if (tribunal) query = query.eq('tribunal', tribunal);
    if (dataInicial) query = query.gte('distribution_date', dataInicial);
    if (dataFinal) query = query.lte('distribution_date', dataFinal);

    query = query.order('distribution_date', { ascending: false }).range(offset, offset + limit - 1);

    const { data: distributions, error, count } = await query;
    if (error) throw error;

    const total = count || 0;

    if (authResult.clientSystemId && distributions && distributions.length > 0) {
      await supabase.from('api_delivery_cursors').upsert({
        client_system_id: authResult.clientSystemId,
        service_type: 'distributions',
        last_delivered_id: distributions[distributions.length - 1].id,
        last_delivered_at: new Date().toISOString(),
        pending_confirmation: true,
        total_delivered: Math.min(offset + limit, total),
        batch_size: limit,
      }, { onConflict: 'client_system_id,service_type' });
    }

    await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-distributions', 'GET', 200, Date.now() - startTime, req);

    return jsonResponse({
      data: distributions,
      pagination: { total, limit, offset, has_more: offset + limit < total },
      batch: authResult.clientSystemId ? {
        pending_confirmation: (distributions?.length || 0) > 0,
        records_in_batch: distributions?.length || 0,
        total_delivered: Math.min(offset + limit, total),
      } : undefined,
      rate_limit: authResult.rateLimitInfo,
    }, 200, rateLimitHeaders);

  } catch (error) {
    console.error('Error in api-distributions:', error);
    await logRequest(undefined, undefined, '/api-distributions', req.method, 500, Date.now() - startTime, req);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
