/**
 * Service configuration utility
 * Fetches and caches partner service configurations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface ServiceConfig {
  id: string;
  partner_id: string;
  service_name: string;
  service_type: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  office_code: number | null;
  is_active: boolean;
  config: any;
  last_sync_at: string | null;
}

/**
 * Get all active services of a specific type
 */
export async function getActiveServices(serviceType: string): Promise<ServiceConfig[]> {
  console.log(`Fetching active services of type: ${serviceType}`);

  const { data, error } = await supabase
    .from('partner_services')
    .select('*')
    .eq('service_type', serviceType)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching services:', error);
    throw error;
  }

  console.log(`Found ${data?.length || 0} active services`);
  return data || [];
}

/**
 * Get a specific service by ID
 */
export async function getServiceById(serviceId: string): Promise<ServiceConfig | null> {
  console.log(`Fetching service: ${serviceId}`);

  const { data, error } = await supabase
    .from('partner_services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (error) {
    console.error('Error fetching service:', error);
    throw error;
  }

  return data;
}

/**
 * Update last sync timestamp for a service
 */
export async function updateLastSync(serviceId: string): Promise<void> {
  const { error } = await supabase
    .from('partner_services')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', serviceId);

  if (error) {
    console.error('Error updating last sync:', error);
    throw error;
  }

  console.log(`Updated last_sync_at for service: ${serviceId}`);
}

/**
 * Validate service configuration
 */
export function validateService(service: ServiceConfig): void {
  if (!service.service_url) {
    throw new Error('Service URL is required');
  }

  if (!service.nome_relacional) {
    throw new Error('Nome relacional is required');
  }

  if (!service.token) {
    throw new Error('Token is required');
  }

  console.log(`Service configuration valid: ${service.service_name}`);
}
