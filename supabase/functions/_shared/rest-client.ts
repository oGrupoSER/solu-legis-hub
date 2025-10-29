/**
 * REST Client for Solucionare REST APIs
 * Handles authentication and retry logic
 */

import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.3.2';

export interface RestConfig {
  baseUrl: string;
  nomeRelacional: string;
  token: string;
  authInQuery?: boolean; // If true, sends nomeRelacional and token as query params instead of headers
}

export class RestClient {
  private config: RestConfig;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(config: RestConfig) {
    this.config = config;
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, this.config.baseUrl);
    
    // Add authentication as query parameters if authInQuery is true
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

  /**
   * Sleep for retry delay
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with retry logic
   */
  private async requestWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);

      // Retry on server errors (5xx) or rate limiting (429)
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

  /**
   * GET request
   */
  async get(endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);

    console.log(`REST GET: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication as headers if authInQuery is false (default)
    if (!this.config.authInQuery) {
      headers['nomeRelacional'] = this.config.nomeRelacional;
      headers['token'] = this.config.token;
    }

    const response = await this.requestWithRetry(url, {
      method: 'GET',
      headers,
    });

    console.log(`REST Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`REST Error Response: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    console.log(`REST Content-Type: ${contentType}`);
    console.log(`REST Response Body (first 500 chars): ${responseText.substring(0, 500)}`);
    
    if (!responseText || responseText.trim() === '') {
      console.log('Empty response body');
      return null;
    }

    // Try XML first if content-type indicates or response starts with '<'
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

    // Fallback to JSON
    return JSON.parse(responseText);
  }

  /**
   * POST request
   */
  async post(endpoint: string, body?: any, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);

    console.log(`REST POST: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication as headers if authInQuery is false (default)
    if (!this.config.authInQuery) {
      headers['nomeRelacional'] = this.config.nomeRelacional;
      headers['token'] = this.config.token;
    }

    const response = await this.requestWithRetry(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * PUT request
   */
  async put(endpoint: string, body?: any, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);

    console.log(`REST PUT: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication as headers if authInQuery is false (default)
    if (!this.config.authInQuery) {
      headers['nomeRelacional'] = this.config.nomeRelacional;
      headers['token'] = this.config.token;
    }

    const response = await this.requestWithRetry(url, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * DELETE request
   */
  async delete(endpoint: string, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);

    console.log(`REST DELETE: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication as headers if authInQuery is false (default)
    if (!this.config.authInQuery) {
      headers['nomeRelacional'] = this.config.nomeRelacional;
      headers['token'] = this.config.token;
    }

    const response = await this.requestWithRetry(url, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // DELETE might not return content
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
}
