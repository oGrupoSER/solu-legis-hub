/**
 * API endpoint for querying distributions
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
      await logRequest(undefined, undefined, '/api-distributions', req.method, 401, Date.now() - startTime, req);
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (authResult.tokenId && !(await checkRateLimit(authResult.tokenId))) {
      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-distributions', req.method, 429, Date.now() - startTime, req);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Maximum 1000 requests per hour.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api-distributions - List distributions with filters
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const termo = url.searchParams.get('termo');
      const tribunal = url.searchParams.get('tribunal');
      const dataInicial = url.searchParams.get('data_inicial');
      const dataFinal = url.searchParams.get('data_final');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('distributions')
        .select('*', { count: 'exact' });

      if (termo) {
        query = query.eq('term', termo);
      }
      if (tribunal) {
        query = query.eq('tribunal', tribunal);
      }
      if (dataInicial) {
        query = query.gte('distribution_date', dataInicial);
      }
      if (dataFinal) {
        query = query.lte('distribution_date', dataFinal);
      }

      query = query
        .order('distribution_date', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: distributions, error, count } = await query;

      if (error) throw error;

      await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-distributions', req.method, 200, Date.now() - startTime, req);

      return new Response(
        JSON.stringify({ 
          data: distributions, 
          count: count || 0,
          limit,
          offset 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    await logRequest(authResult.tokenId, authResult.clientSystemId, '/api-distributions', req.method, 405, Date.now() - startTime, req);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in api-distributions:', error);
    await logRequest(undefined, undefined, '/api-distributions', req.method, 500, Date.now() - startTime, req);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
