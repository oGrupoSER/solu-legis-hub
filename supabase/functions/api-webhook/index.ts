/**
 * Webhook notification system
 * Sends events to registered client webhooks
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event: 'process.new' | 'process.updated' | 'distribution.new' | 'publication.new';
  data: any;
  timestamp: string;
}

/**
 * Sign webhook payload with HMAC SHA256
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send webhook to client system
 */
async function sendWebhook(webhookUrl: string, payload: WebhookPayload, secret?: string) {
  const payloadString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'SoluLegisHub-Webhook/1.0'
  };

  // Add signature if secret is provided
  if (secret) {
    headers['X-Webhook-Signature'] = await signPayload(payloadString, secret);
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payloadString
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    console.error(`Failed to send webhook to ${webhookUrl}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // POST /api-webhook - Trigger webhook notifications
    if (req.method === 'POST') {
      const { event, data, clientSystemIds } = await req.json();

      if (!event || !data) {
        return new Response(
          JSON.stringify({ error: 'Missing event or data in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determine event type based on the event string
      let eventType: string;
      if (event.includes('process')) {
        eventType = 'processes';
      } else if (event.includes('distribution')) {
        eventType = 'distributions';
      } else if (event.includes('publication')) {
        eventType = 'publications';
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid event type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get active webhooks that are subscribed to this event
      let webhooksQuery = supabase
        .from('client_webhooks')
        .select('*')
        .eq('is_active', true)
        .contains('events', [eventType]);

      // Filter by specific client systems if provided
      if (clientSystemIds && clientSystemIds.length > 0) {
        webhooksQuery = webhooksQuery.in('client_system_id', clientSystemIds);
      }

      const { data: webhooks, error } = await webhooksQuery;

      if (error) throw error;

      if (!webhooks || webhooks.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No active webhooks found for this event', sent: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send webhooks to all registered clients
      const payload: WebhookPayload = {
        event: event as any,
        data,
        timestamp: new Date().toISOString()
      };

      const results = await Promise.all(
        webhooks.map(webhook => sendWebhook(webhook.webhook_url, payload, webhook.secret))
      );

      const successCount = results.filter(r => r.success).length;

      return new Response(
        JSON.stringify({ 
          message: `Webhooks sent`, 
          sent: successCount,
          total: webhooks.length,
          results 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in api-webhook:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
