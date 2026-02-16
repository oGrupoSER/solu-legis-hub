/**
 * Authentication middleware for API endpoints
 * Validates API tokens, IP rules, rate limits, service access, and security logging
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEFAULT_RATE_LIMIT = 1000;
const DEFAULT_BATCH_SIZE = 500;

export interface AuthResult {
  authenticated: boolean;
  clientSystemId?: string;
  tokenId?: string;
  error?: string;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
  isAdmin?: boolean;
}

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

/**
 * Log a blocked security event
 */
async function logSecurityEvent(
  ipAddress: string,
  tokenId: string | undefined,
  clientSystemId: string | undefined,
  endpoint: string,
  blockReason: string,
  request: Request
) {
  try {
    await supabase.from('api_security_logs').insert({
      ip_address: ipAddress,
      token_id: tokenId || null,
      client_system_id: clientSystemId || null,
      endpoint,
      block_reason: blockReason,
      request_method: request.method,
      user_agent: request.headers.get('user-agent') || 'unknown',
    });
  } catch (e) {
    console.error('Failed to log security event:', e);
  }
}

/**
 * Check if an IP is blocked by global or client-specific rules
 */
async function checkIpRules(ip: string, clientSystemId?: string): Promise<{ blocked: boolean; reason?: string }> {
  if (ip === 'unknown') return { blocked: false };

  // Check global IP rules (client_system_id IS NULL) and client-specific rules
  let query = supabase
    .from('api_ip_rules')
    .select('ip_address, rule_type, reason, client_system_id, expires_at')
    .eq('is_active', true)
    .eq('rule_type', 'block');

  const { data: rules } = await query;

  if (!rules || rules.length === 0) return { blocked: false };

  for (const rule of rules) {
    // Skip expired rules
    if (rule.expires_at && new Date(rule.expires_at) < new Date()) continue;

    // Check scope: global (null client_system_id) or matching client
    if (rule.client_system_id && rule.client_system_id !== clientSystemId) continue;

    // Simple IP match or CIDR prefix match
    if (rule.ip_address === ip || ip.startsWith(rule.ip_address.replace('/24', '').replace('/16', '').replace('/8', ''))) {
      return { blocked: true, reason: rule.reason || 'IP blocked by security rule' };
    }
  }

  return { blocked: false };
}

/**
 * Validate API token or Supabase JWT from request headers
 * Enhanced with: token blocking, IP validation, rate limit override, service access check
 */
export async function validateToken(request: Request, serviceType?: string): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  const clientIp = getClientIp(request);
  const endpoint = new URL(request.url).pathname;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header. Expected: Bearer <token>' };
  }

  const token = authHeader.substring(7);
  if (!token) {
    return { authenticated: false, error: 'Token is empty' };
  }

  // 1. Try to validate as API token
  const { data: tokenData, error: tokenError } = await supabase
    .from('api_tokens')
    .select('id, client_system_id, is_active, expires_at, is_blocked, blocked_reason, rate_limit_override, allowed_ips')
    .eq('token', token)
    .maybeSingle();

  if (tokenData && !tokenError) {
    // Check if token is active
    if (!tokenData.is_active) {
      await logSecurityEvent(clientIp, tokenData.id, tokenData.client_system_id, endpoint, 'token_inactive', request);
      return { authenticated: false, error: 'Token is inactive' };
    }

    // 2. Check if token is blocked
    if (tokenData.is_blocked) {
      await logSecurityEvent(clientIp, tokenData.id, tokenData.client_system_id, endpoint, 'token_blocked', request);
      return { authenticated: false, error: `Token is blocked: ${tokenData.blocked_reason || 'No reason provided'}` };
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      await logSecurityEvent(clientIp, tokenData.id, tokenData.client_system_id, endpoint, 'token_expired', request);
      return { authenticated: false, error: 'Token has expired' };
    }

    // 3. Check IP against global and client-specific rules
    const ipCheck = await checkIpRules(clientIp, tokenData.client_system_id);
    if (ipCheck.blocked) {
      await logSecurityEvent(clientIp, tokenData.id, tokenData.client_system_id, endpoint, 'ip_blocked', request);
      return { authenticated: false, error: `Access denied: ${ipCheck.reason}` };
    }

    // 4. Check allowed_ips whitelist on token
    if (tokenData.allowed_ips && tokenData.allowed_ips.length > 0) {
      if (!tokenData.allowed_ips.includes(clientIp)) {
        await logSecurityEvent(clientIp, tokenData.id, tokenData.client_system_id, endpoint, 'ip_not_whitelisted', request);
        return { authenticated: false, error: 'IP not in allowed list for this token' };
      }
    }

    // 5. Check rate limit with override support
    const rateLimit = tokenData.rate_limit_override || DEFAULT_RATE_LIMIT;
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { count: requestCount } = await supabase
      .from('api_requests')
      .select('*', { count: 'exact', head: true })
      .eq('token_id', tokenData.id)
      .gte('request_time', oneHourAgo.toISOString());

    const currentCount = requestCount || 0;
    if (currentCount >= rateLimit) {
      await logSecurityEvent(clientIp, tokenData.id, tokenData.client_system_id, endpoint, 'rate_limit', request);
      const resetAt = new Date();
      resetAt.setHours(resetAt.getHours() + 1);
      return {
        authenticated: false,
        error: `Rate limit exceeded. Maximum ${rateLimit} requests per hour.`,
        rateLimitInfo: { limit: rateLimit, remaining: 0, resetAt: resetAt.toISOString() },
      };
    }

    // 6. Check service access via client_system_services
    if (serviceType && tokenData.client_system_id) {
      const { data: serviceAccess } = await supabase
        .from('client_system_services')
        .select('id, partner_service_id')
        .eq('client_system_id', tokenData.client_system_id)
        .eq('is_active', true);

      if (serviceAccess && serviceAccess.length > 0) {
        // Get partner_service_ids and check if any match the requested service_type
        const serviceIds = serviceAccess.map(s => s.partner_service_id);
        const { data: matchingServices } = await supabase
          .from('partner_services')
          .select('id')
          .in('id', serviceIds)
          .eq('service_type', serviceType)
          .eq('is_active', true);

        if (!matchingServices || matchingServices.length === 0) {
          await logSecurityEvent(clientIp, tokenData.id, tokenData.client_system_id, endpoint, 'service_denied', request);
          return { authenticated: false, error: `Access denied: client does not have access to ${serviceType} service` };
        }
      }
    }

    // Update last_used_at
    await supabase
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    const resetAt = new Date();
    resetAt.setHours(resetAt.getHours() + 1);

    return {
      authenticated: true,
      clientSystemId: tokenData.client_system_id,
      tokenId: tokenData.id,
      isAdmin: false,
      rateLimitInfo: {
        limit: rateLimit,
        remaining: rateLimit - currentCount - 1,
        resetAt: resetAt.toISOString(),
      },
    };
  }

  // If not an API token, try Supabase JWT (admin/internal use)
  try {
    const { data: { user }, error: jwtError } = await supabase.auth.getUser(token);
    if (jwtError || !user) {
      return { authenticated: false, error: 'Invalid token' };
    }
    return { authenticated: true, isAdmin: true };
  } catch {
    return { authenticated: false, error: 'Invalid token' };
  }
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
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  await supabase.from('api_requests').insert({
    token_id: tokenId,
    client_system_id: clientSystemId,
    endpoint,
    method,
    status_code: statusCode,
    response_time_ms: responseTimeMs,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

/**
 * Check rate limit (kept for backward compat, now handled in validateToken)
 */
export async function checkRateLimit(tokenId: string): Promise<boolean> {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const { count } = await supabase
    .from('api_requests')
    .select('*', { count: 'exact', head: true })
    .eq('token_id', tokenId)
    .gte('request_time', oneHourAgo.toISOString());

  return (count || 0) < DEFAULT_RATE_LIMIT;
}

/**
 * Build rate limit headers from auth result
 */
export function buildRateLimitHeaders(authResult: AuthResult): Record<string, string> {
  if (!authResult.rateLimitInfo) return {};
  return {
    'X-RateLimit-Limit': String(authResult.rateLimitInfo.limit),
    'X-RateLimit-Remaining': String(Math.max(0, authResult.rateLimitInfo.remaining)),
    'X-RateLimit-Reset': authResult.rateLimitInfo.resetAt,
  };
}

/**
 * Validate and sanitize common query params
 */
export function sanitizeParams(url: URL) {
  const limitRaw = parseInt(url.searchParams.get('limit') || '500');
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 500 : limitRaw), DEFAULT_BATCH_SIZE);
  
  const offsetRaw = parseInt(url.searchParams.get('offset') || '0');
  const offset = Math.max(0, isNaN(offsetRaw) ? 0 : offsetRaw);

  const id = url.searchParams.get('id');
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { error: 'Invalid UUID format for id parameter' };
  }

  const dataInicial = url.searchParams.get('data_inicial');
  if (dataInicial && isNaN(Date.parse(dataInicial))) {
    return { error: 'Invalid date format for data_inicial. Use ISO 8601 (YYYY-MM-DD)' };
  }

  const dataFinal = url.searchParams.get('data_final');
  if (dataFinal && isNaN(Date.parse(dataFinal))) {
    return { error: 'Invalid date format for data_final. Use ISO 8601 (YYYY-MM-DD)' };
  }

  return { limit, offset, id, dataInicial, dataFinal };
}
