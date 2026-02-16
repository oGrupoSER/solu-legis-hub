/**
 * API endpoint for publications - with client isolation and batch control
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
    .in('term_type', ['publications', 'name', 'office']);

  return (terms || []).map(t => t.term);
}

serve(async (req) => {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await validateToken(req, 'publications');

    if (!authResult.authenticated) {
      await logRequest(undefined, undefined, '/api-publications', req.method, 401, Date.now() - startTime, req);
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
        .eq('service_type', 'publications')
        .maybeSingle();

      if (!cursor || !cursor.pending_confirmation) {
        return jsonResponse({ error: 'No pending batch to confirm' }, 400, rateLimitHeaders);
      }

      await supabase
        .from('api_delivery_cursors')
        .update({ pending_confirmation: false, confirmed_at: new Date().toISOString() })
        .eq('id', cursor.id);

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-publications/confirm', 'POST', 200, Date.now() - startTime, req);
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
    const diario = url.searchParams.get('diario');

    // Single publication
    if (id) {
      const { data: pub, error } = await supabase.from('publications').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!pub) return jsonResponse({ error: 'Publication not found' }, 404, rateLimitHeaders);

      if (authResult.clientSystemId) {
        const clientTerms = await getClientTerms(authResult.clientSystemId);
        if (clientTerms.length > 0 && pub.matched_terms) {
          const hasAccess = pub.matched_terms.some((t: string) => clientTerms.includes(t));
          if (!hasAccess) return jsonResponse({ error: 'Publication not found or not linked to your account' }, 404, rateLimitHeaders);
        }
      }

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-publications', 'GET', 200, Date.now() - startTime, req);
      return jsonResponse({ data: pub }, 200, rateLimitHeaders);
    }

    // Check pending batch
    if (authResult.clientSystemId) {
      const { data: cursor } = await supabase
        .from('api_delivery_cursors')
        .select('*')
        .eq('client_system_id', authResult.clientSystemId)
        .eq('service_type', 'publications')
        .maybeSingle();

      if (cursor?.pending_confirmation) {
        await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-publications', 'GET', 200, Date.now() - startTime, req);
        return jsonResponse({
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
          batch: {
            pending_confirmation: true,
            message: 'Please confirm the previous batch before requesting new data. POST /api-publications?action=confirm',
            total_delivered: cursor.total_delivered,
          },
          rate_limit: authResult.rateLimitInfo,
        }, 200, rateLimitHeaders);
      }
    }

    let query = supabase.from('publications').select('*', { count: 'exact' });

    // Client isolation via matched_terms
    if (authResult.clientSystemId) {
      const clientTerms = await getClientTerms(authResult.clientSystemId);
      if (clientTerms.length === 0) {
        await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-publications', 'GET', 200, Date.now() - startTime, req);
        return jsonResponse({
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
          rate_limit: authResult.rateLimitInfo,
        }, 200, rateLimitHeaders);
      }
      query = query.overlaps('matched_terms', clientTerms);
    }

    if (termo) query = query.contains('matched_terms', [termo]);
    if (diario) query = query.eq('gazette_name', diario);
    if (dataInicial) query = query.gte('publication_date', dataInicial);
    if (dataFinal) query = query.lte('publication_date', dataFinal);

    query = query.order('publication_date', { ascending: false }).range(offset, offset + limit - 1);

    const { data: publications, error, count } = await query;
    if (error) throw error;

    const total = count || 0;

    if (authResult.clientSystemId && publications && publications.length > 0) {
      await supabase.from('api_delivery_cursors').upsert({
        client_system_id: authResult.clientSystemId,
        service_type: 'publications',
        last_delivered_id: publications[publications.length - 1].id,
        last_delivered_at: new Date().toISOString(),
        pending_confirmation: true,
        total_delivered: Math.min(offset + limit, total),
        batch_size: limit,
      }, { onConflict: 'client_system_id,service_type' });
    }

    await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-publications', 'GET', 200, Date.now() - startTime, req);

    return jsonResponse({
      data: publications,
      pagination: { total, limit, offset, has_more: offset + limit < total },
      batch: authResult.clientSystemId ? {
        pending_confirmation: (publications?.length || 0) > 0,
        records_in_batch: publications?.length || 0,
        total_delivered: Math.min(offset + limit, total),
      } : undefined,
      rate_limit: authResult.rateLimitInfo,
    }, 200, rateLimitHeaders);

  } catch (error) {
    console.error('Error in api-publications:', error);
    await logRequest(undefined, undefined, '/api-publications', req.method, 500, Date.now() - startTime, req);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
