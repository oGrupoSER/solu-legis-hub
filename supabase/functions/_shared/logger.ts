/**
 * Centralized logging utility for Edge Functions
 * Handles sync_logs and api_call_logs table insertions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface LogEntry {
  partner_service_id: string;
  sync_type: string;
  status: 'in_progress' | 'success' | 'error';
  records_synced?: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ApiCallLog {
  sync_log_id?: string;
  partner_service_id?: string;
  call_type: 'REST' | 'SOAP';
  method: string;
  url: string;
  request_headers?: Record<string, string>;
  request_body?: string;
  response_status?: number;
  response_status_text?: string;
  response_headers?: Record<string, string>;
  response_summary?: string;
  duration_ms?: number;
  error_message?: string;
}

export class Logger {
  private logId: string | null = null;
  private partnerServiceId: string | null = null;

  /**
   * Start a sync log entry
   */
  async start(entry: Omit<LogEntry, 'status' | 'completed_at'>): Promise<string> {
    const { data, error } = await supabase
      .from('sync_logs')
      .insert({
        partner_service_id: entry.partner_service_id,
        sync_type: entry.sync_type,
        status: 'in_progress',
        records_synced: 0,
        started_at: entry.started_at || new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Failed to create sync log:', error);
      throw error || new Error('No data returned');
    }

    this.logId = data.id;
    this.partnerServiceId = entry.partner_service_id;
    console.log(`Sync log started: ${this.logId} for ${entry.sync_type}`);
    return data.id;
  }

  /**
   * Update sync log with success
   */
  async success(recordsSynced: number): Promise<void> {
    if (!this.logId) {
      console.warn('No log ID to update');
      return;
    }

    const { error } = await supabase
      .from('sync_logs')
      .update({
        status: 'success',
        records_synced: recordsSynced,
        completed_at: new Date().toISOString(),
      })
      .eq('id', this.logId);

    if (error) {
      console.error('Failed to update sync log:', error);
    } else {
      console.log(`Sync log completed successfully: ${this.logId} with ${recordsSynced} records`);
    }
  }

  /**
   * Update sync log with error
   */
  async error(errorMessage: string): Promise<void> {
    if (!this.logId) {
      console.warn('No log ID to update');
      return;
    }

    const { error } = await supabase
      .from('sync_logs')
      .update({
        status: 'error',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', this.logId);

    if (error) {
      console.error('Failed to update sync log:', error);
    } else {
      console.error(`Sync log failed: ${this.logId} - ${errorMessage}`);
    }
  }

  /**
   * Update progress during sync
   */
  async updateProgress(recordsSynced: number): Promise<void> {
    if (!this.logId) return;

    const { error } = await supabase
      .from('sync_logs')
      .update({ records_synced: recordsSynced })
      .eq('id', this.logId);

    if (error) {
      console.error('Failed to update progress:', error);
    }
  }

  /**
   * Log an API call (REST or SOAP)
   */
  async logApiCall(entry: ApiCallLog): Promise<void> {
    try {
      // Truncate large bodies to 10KB
      const maxBodyLen = 10000;
      const truncatedRequestBody = entry.request_body && entry.request_body.length > maxBodyLen
        ? entry.request_body.substring(0, maxBodyLen) + '... [TRUNCATED]'
        : entry.request_body;

      const { error } = await supabase
        .from('api_call_logs')
        .insert({
          sync_log_id: entry.sync_log_id || this.logId,
          partner_service_id: entry.partner_service_id || this.partnerServiceId,
          call_type: entry.call_type,
          method: entry.method,
          url: entry.url,
          request_headers: entry.request_headers ? this.sanitizeHeaders(entry.request_headers) : null,
          request_body: truncatedRequestBody || null,
          response_status: entry.response_status,
          response_status_text: entry.response_status_text,
          response_headers: entry.response_headers || null,
          response_summary: entry.response_summary,
          duration_ms: entry.duration_ms,
          error_message: entry.error_message,
        });

      if (error) {
        console.error('Failed to log API call:', error);
      }
    } catch (err) {
      console.error('Error logging API call:', err);
    }
  }

  /**
   * Remove sensitive values from headers for logging
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    // Mask token values but keep structure visible
    if (sanitized['token']) {
      sanitized['token'] = sanitized['token'].substring(0, 8) + '***';
    }
    return sanitized;
  }

  /** Get current sync log ID */
  get currentLogId(): string | null {
    return this.logId;
  }

  /** Get current partner service ID */
  get currentPartnerServiceId(): string | null {
    return this.partnerServiceId;
  }
}
