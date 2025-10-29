/**
 * Centralized logging utility for Edge Functions
 * Handles sync_logs table insertions
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

export class Logger {
  private logId: string | null = null;

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
}
