/**
 * API endpoint for querying processes and movements
 * Requires authentication via API token
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';
import { validateToken, logRequest, checkRateLimit } from '../_shared/auth-middleware.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate request
    const authResult = await validateToken(req);
    
    if (!authResult.authenticated) {
      await logRequest(undefined, undefined, '/api-processes', req.method, 401, Date.now() - startTime, req);
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (authResult.tokenId && !(await checkRateLimit(authResult.tokenId))) {
      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', req.method, 429, Date.now() - startTime, req);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Maximum 1000 requests per hour.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const processId = url.pathname.split('/').pop();
    const isMovementsRequest = url.pathname.includes('/movements');

    // GET /api-processes/:id/movements - Get movements for a specific process
    if (req.method === 'GET' && isMovementsRequest && processId) {
      const { data: movements, error } = await supabase
        .from('process_movements')
        .select('*')
        .eq('process_id', processId)
        .order('movement_date', { ascending: false });

      if (error) throw error;

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes/movements', req.method, 200, Date.now() - startTime, req);
      
      return new Response(
        JSON.stringify({ data: movements, count: movements?.length || 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-processes - List processes with filters
    if (req.method === 'GET') {
      const numero = url.searchParams.get('numero');
      const tribunal = url.searchParams.get('tribunal');
      const instancia = url.searchParams.get('instancia');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('processes')
        .select('*', { count: 'exact' });

      if (numero) {
        query = query.eq('process_number', numero);
      }
      if (tribunal) {
        query = query.eq('tribunal', tribunal);
      }
      if (instancia) {
        query = query.eq('instance', instancia);
      }
      if (status) {
        query = query.eq('status', status);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: processes, error, count } = await query;

      if (error) throw error;

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', req.method, 200, Date.now() - startTime, req);

      return new Response(
        JSON.stringify({ 
          data: processes, 
          count: count || 0,
          limit,
          offset 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-processes', req.method, 405, Date.now() - startTime, req);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in api-processes:', error);
    await logRequest(undefined, undefined, '/api-processes', req.method, 500, Date.now() - startTime, req);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
