/**
 * Manage Distribution Terms Edge Function
 * CRUD operations for distribution names/offices in Solucionare WebAPI V3
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ServiceConfig {
  id: string;
  partner_id: string;
  service_url: string;
  nome_relacional: string;
  token: string;
}

/**
 * Authenticate with Solucionare API
 */
async function authenticate(service: ServiceConfig): Promise<string> {
  const response = await fetch(`${service.service_url}/AutenticaAPI`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nomeRelacional: service.nome_relacional,
      token: service.token,
    }),
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

/**
 * Make authenticated API request
 */
async function apiRequest(
  baseUrl: string,
  endpoint: string,
  jwtToken: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const url = `${baseUrl}${endpoint}`;
  console.log(`API Request: ${method} ${url}`);

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}

/**
 * Get service configuration
 */
async function getService(supabase: any, serviceId: string): Promise<ServiceConfig> {
  const { data, error } = await supabase
    .from('partner_services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Service not found');
  
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, serviceId, ...params } = await req.json();

    if (!serviceId) {
      throw new Error('serviceId is required');
    }

    const service = await getService(supabase, serviceId);
    const jwtToken = await authenticate(service);

    let result;

    switch (action) {
      // ============ NAMES (NOMES) ============
      
      case 'listNames': {
        // Get registered names
        result = await apiRequest(
          service.service_url,
          '/BuscaNomesCadastrados',
          jwtToken
        );
        break;
      }

      case 'registerName': {
        // Register new name for distribution monitoring
        const { nome, instancia, abrangencia } = params;
        if (!nome) throw new Error('nome is required');
        
        result = await apiRequest(
          service.service_url,
          '/CadastrarNome',
          jwtToken,
          'POST',
          { nome, instancia: instancia || 1, abrangencia: abrangencia || 'NACIONAL' }
        );

        // Also save to local database
        await supabase.from('search_terms').insert({
          term: nome,
          term_type: 'distribution',
          partner_service_id: serviceId,
          partner_id: service.partner_id,
          is_active: true,
        });
        break;
      }

      case 'editNameScope': {
        // Edit name instance/scope
        const { codNome, instancia, abrangencia } = params;
        if (!codNome) throw new Error('codNome is required');
        
        result = await apiRequest(
          service.service_url,
          '/EditarInstanciaAbrangenciaNome',
          jwtToken,
          'PUT',
          { codNome, instancia, abrangencia }
        );
        break;
      }

      case 'activateName': {
        // Activate a name
        const { codNome } = params;
        if (!codNome) throw new Error('codNome is required');
        
        result = await apiRequest(
          service.service_url,
          `/AtivarNome?codNome=${codNome}`,
          jwtToken,
          'PUT'
        );

        // Update local database
        await supabase
          .from('search_terms')
          .update({ is_active: true })
          .eq('partner_service_id', serviceId)
          .eq('term_type', 'distribution');
        break;
      }

      case 'deactivateName': {
        // Deactivate a name
        const { codNome } = params;
        if (!codNome) throw new Error('codNome is required');
        
        result = await apiRequest(
          service.service_url,
          `/DesativarNome?codNome=${codNome}`,
          jwtToken,
          'PUT'
        );

        // Update local database
        await supabase
          .from('search_terms')
          .update({ is_active: false })
          .eq('partner_service_id', serviceId)
          .eq('term_type', 'distribution');
        break;
      }

      case 'deleteName': {
        // Delete a name
        const { codNome, termo } = params;
        if (!codNome) throw new Error('codNome is required');
        
        result = await apiRequest(
          service.service_url,
          `/ExcluirNome?codNome=${codNome}`,
          jwtToken,
          'DELETE'
        );

        // Delete from local database
        if (termo) {
          await supabase
            .from('search_terms')
            .delete()
            .eq('partner_service_id', serviceId)
            .eq('term', termo)
            .eq('term_type', 'distribution');
        }
        break;
      }

      // ============ OFFICES (ESCRITÓRIOS) ============

      case 'registerOffice': {
        // Register new office
        const { nomeEscritorio, codAbrangencia } = params;
        if (!nomeEscritorio) throw new Error('nomeEscritorio is required');
        
        result = await apiRequest(
          service.service_url,
          '/CadastrarEscritorio',
          jwtToken,
          'POST',
          { nomeEscritorio, codAbrangencia: codAbrangencia || 1 }
        );
        break;
      }

      case 'activateOffice': {
        // Activate an office
        const { codEscritorio } = params;
        if (!codEscritorio) throw new Error('codEscritorio is required');
        
        result = await apiRequest(
          service.service_url,
          `/AtivarEscritorio?codEscritorio=${codEscritorio}`,
          jwtToken,
          'PUT'
        );
        break;
      }

      case 'deactivateOffice': {
        // Deactivate an office
        const { codEscritorio } = params;
        if (!codEscritorio) throw new Error('codEscritorio is required');
        
        result = await apiRequest(
          service.service_url,
          `/DesativarEscritorio?codEscritorio=${codEscritorio}`,
          jwtToken,
          'PUT'
        );
        break;
      }

      // ============ SCOPES (ABRANGÊNCIAS) ============

      case 'listScopes': {
        // Get available scopes
        result = await apiRequest(
          service.service_url,
          '/BuscaAbrangencias',
          jwtToken
        );
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Manage distribution terms error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
