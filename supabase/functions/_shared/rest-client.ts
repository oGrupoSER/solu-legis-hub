/**
 * REST Client for Solucionare REST APIs
 * Handles authentication, retry logic, and API call logging
 */

import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.3.2';
import { Logger } from './logger.ts';

export interface RestConfig {
  baseUrl: string;
  nomeRelacional: string;
  token: string;
  authInQuery?: boolean;
}

export class RestClient {
  private config: RestConfig;
  private maxRetries = 3;
  private retryDelay = 1000;
  private logger: Logger | null = null;

  constructor(config: RestConfig) {
    this.config = config;
  }

  /** Attach a Logger instance for API call logging */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    let baseUrl = this.config.baseUrl;
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    const fullUrl = baseUrl + cleanEndpoint;
    const url = new URL(fullUrl);
    
    if (this.config.authInQuery) {
      url.searchParams.append('nomeRelacional', this.config.nomeRelacional);
      url.searchParams.append('token', this.config.token);
    }
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async requestWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      if ((response.status >= 500 || response.status === 429) && attempt < this.maxRetries) {
        console.log(`Request failed with status ${response.status}, retrying (${attempt}/${this.maxRetries})...`);
        await this.sleep(this.retryDelay * attempt);
        return this.requestWithRetry(url, options, attempt + 1);
      }
      return response;
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.log(`Request failed, retrying (${attempt}/${this.maxRetries})...`, error);
        await this.sleep(this.retryDelay * attempt);
        return this.requestWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  async get(endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);
    console.log(`REST GET: ${url}`);

    const headers: Record<string, string> = {
      'Accept': 'text/xml, application/xml, application/json, */*',
      'User-Agent': 'Lovable-Sync/1.0',
    };

    if (!this.config.authInQuery) {
      headers['nomeRelacional'] = this.config.nomeRelacional;
      headers['token'] = this.config.token;
    }

    const startTime = Date.now();
    let responseStatus: number | undefined;
    let responseStatusText: string | undefined;
    let responseSummary: string | undefined;
    let errorMsg: string | undefined;

    try {
      const response = await this.requestWithRetry(url, { method: 'GET', headers });
      responseStatus = response.status;
      responseStatusText = response.statusText;

      console.log(`REST Response Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        errorMsg = `HTTP ${response.status}: ${errorText.substring(0, 500)}`;
        responseSummary = `Error: ${errorText.substring(0, 200)}`;
        console.error(`REST Error Response: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseText = await response.text();
      const contentType = response.headers.get('content-type') || '';
      console.log(`REST Content-Type: ${contentType}`);
      console.log(`REST Response Body (first 500 chars): ${responseText.substring(0, 500)}`);
      
      // Build summary: size + type
      responseSummary = `${contentType.split(';')[0]} | ${responseText.length} bytes`;

      if (!responseText || responseText.trim() === '') {
        responseSummary = 'Empty response';
        return null;
      }

      const trimmed = responseText.trim();
      if (contentType.includes('xml') || trimmed.startsWith('<')) {
        try {
          const parser = new XMLParser({ ignoreAttributes: false });
          const parsed = parser.parse(responseText);
          return parsed;
        } catch (e) {
          console.error('Failed to parse XML response:', e);
          throw e;
        }
      }

      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed)) {
        responseSummary += ` | ${parsed.length} registros`;
      }
      return parsed;
    } catch (err) {
      if (!errorMsg) {
        errorMsg = err instanceof Error ? err.message : String(err);
      }
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      if (this.logger) {
        await this.logger.logApiCall({
          call_type: 'REST',
          method: 'GET',
          url,
          request_headers: this.sanitizeHeaders(headers),
          response_status: responseStatus,
          response_status_text: responseStatusText,
          response_summary: responseSummary,
          duration_ms: duration,
          error_message: errorMsg,
        });
      }
    }
  }

  async post(endpoint: string, body?: any, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);
    console.log(`REST POST: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!this.config.authInQuery) {
      headers['nomeRelacional'] = this.config.nomeRelacional;
      headers['token'] = this.config.token;
    }

    const bodyStr = body ? JSON.stringify(body) : undefined;
    const startTime = Date.now();
    let responseStatus: number | undefined;
    let responseStatusText: string | undefined;
    let responseSummary: string | undefined;
    let errorMsg: string | undefined;

    try {
      const response = await this.requestWithRetry(url, {
        method: 'POST',
        headers,
        body: bodyStr,
      });
      responseStatus = response.status;
      responseStatusText = response.statusText;

      if (!response.ok) {
        const errorText = await response.text();
        errorMsg = `HTTP ${response.status}: ${errorText.substring(0, 500)}`;
        responseSummary = `Error: ${errorText.substring(0, 200)}`;
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      if (Array.isArray(result)) {
        responseSummary = `${result.length} registros retornados`;
      } else {
        responseSummary = `OK`;
      }
      return result;
    } catch (err) {
      if (!errorMsg) {
        errorMsg = err instanceof Error ? err.message : String(err);
      }
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      if (this.logger) {
        await this.logger.logApiCall({
          call_type: 'REST',
          method: 'POST',
          url,
          request_headers: this.sanitizeHeaders(headers),
          request_body: bodyStr,
          response_status: responseStatus,
          response_status_text: responseStatusText,
          response_summary: responseSummary,
          duration_ms: duration,
          error_message: errorMsg,
        });
      }
    }
  }

  async put(endpoint: string, body?: any, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);
    console.log(`REST PUT: ${url}`);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!this.config.authInQuery) {
      headers['nomeRelacional'] = this.config.nomeRelacional;
      headers['token'] = this.config.token;
    }

    const bodyStr = body ? JSON.stringify(body) : undefined;
    const startTime = Date.now();
    let responseStatus: number | undefined;
    let responseStatusText: string | undefined;
    let responseSummary: string | undefined;
    let errorMsg: string | undefined;

    try {
      const response = await this.requestWithRetry(url, { method: 'PUT', headers, body: bodyStr });
      responseStatus = response.status;
      responseStatusText = response.statusText;

      if (!response.ok) {
        const errorText = await response.text();
        errorMsg = `HTTP ${response.status}: ${errorText.substring(0, 500)}`;
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      responseSummary = 'OK';
      return result;
    } catch (err) {
      if (!errorMsg) errorMsg = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      if (this.logger) {
        await this.logger.logApiCall({
          call_type: 'REST', method: 'PUT', url,
          request_headers: this.sanitizeHeaders(headers),
          request_body: bodyStr,
          response_status: responseStatus, response_status_text: responseStatusText,
          response_summary: responseSummary, duration_ms: duration, error_message: errorMsg,
        });
      }
    }
  }

  async delete(endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);
    console.log(`REST DELETE: ${url}`);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!this.config.authInQuery) {
      headers['nomeRelacional'] = this.config.nomeRelacional;
      headers['token'] = this.config.token;
    }

    const startTime = Date.now();
    let responseStatus: number | undefined;
    let responseStatusText: string | undefined;
    let responseSummary: string | undefined;
    let errorMsg: string | undefined;

    try {
      const response = await this.requestWithRetry(url, { method: 'DELETE', headers });
      responseStatus = response.status;
      responseStatusText = response.statusText;

      if (!response.ok) {
        const errorText = await response.text();
        errorMsg = `HTTP ${response.status}: ${errorText.substring(0, 500)}`;
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      responseSummary = 'OK';
      return text ? JSON.parse(text) : null;
    } catch (err) {
      if (!errorMsg) errorMsg = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      if (this.logger) {
        await this.logger.logApiCall({
          call_type: 'REST', method: 'DELETE', url,
          request_headers: this.sanitizeHeaders(headers),
          response_status: responseStatus, response_status_text: responseStatusText,
          response_summary: responseSummary, duration_ms: duration, error_message: errorMsg,
        });
      }
    }
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    if (sanitized['token']) {
      sanitized['token'] = sanitized['token'].substring(0, 8) + '***';
    }
    if (sanitized['Authorization']) {
      sanitized['Authorization'] = sanitized['Authorization'].substring(0, 15) + '***';
    }
    return sanitized;
  }
}
