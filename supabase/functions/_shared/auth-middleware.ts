/**
 * Authentication middleware for API endpoints
 * Validates API tokens from Authorization header
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AuthResult {
  authenticated: boolean;
  clientSystemId?: string;
  tokenId?: string;
  error?: string;
}

/**
 * Validate API token from request headers
 */
export async function validateToken(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Missing or invalid Authorization header. Expected: Bearer <token>'
    };
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (!token) {
    return {
      authenticated: false,
      error: 'Token is empty'
    };
  }

  // Validate token in database
  const { data: tokenData, error } = await supabase
    .from('api_tokens')
    .select('id, client_system_id, is_active, expires_at')
    .eq('token', token)
    .single();

  if (error || !tokenData) {
    return {
      authenticated: false,
      error: 'Invalid token'
    };
  }

  // Check if token is active
  if (!tokenData.is_active) {
    return {
      authenticated: false,
      error: 'Token is inactive'
    };
  }

  // Check if token is expired
  if (tokenData.expires_at) {
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      return {
        authenticated: false,
        error: 'Token has expired'
      };
    }
  }

  // Update last_used_at
  await supabase
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenData.id);

  return {
    authenticated: true,
    clientSystemId: tokenData.client_system_id,
    tokenId: tokenData.id
  };
}

/**
 * Log API request
 */
export async function logRequest(
  tokenId: string | undefined,
  clientSystemId: string | undefined,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  request: Request
) {
  const ipAddress = request.headers.get('x-forwarded-for') || 
                    request.headers.get('cf-connecting-ip') || 
                    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  await supabase
    .from('api_requests')
    .insert({
      token_id: tokenId,
      client_system_id: clientSystemId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: ipAddress,
      user_agent: userAgent
    });
}

/**
 * Check rate limit (1000 requests per hour per token)
 */
export async function checkRateLimit(tokenId: string): Promise<boolean> {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const { count } = await supabase
    .from('api_requests')
    .select('*', { count: 'exact', head: true })
    .eq('token_id', tokenId)
    .gte('request_time', oneHourAgo.toISOString());

  return (count || 0) < 1000;
}
