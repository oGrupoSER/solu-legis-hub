/**
 * REST Client for Solucionare REST APIs
 * Handles authentication and retry logic
 */

export interface RestConfig {
  baseUrl: string;
  nomeRelacional: string;
  token: string;
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

    const response = await this.requestWithRetry(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'nomeRelacional': this.config.nomeRelacional,
        'token': this.config.token,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * POST request
   */
  async post(endpoint: string, body?: any, params?: Record<string, any>): Promise<any> {
    const url = this.buildUrl(endpoint, params);

    console.log(`REST POST: ${url}`);

    const response = await this.requestWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'nomeRelacional': this.config.nomeRelacional,
        'token': this.config.token,
      },
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

    const response = await this.requestWithRetry(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'nomeRelacional': this.config.nomeRelacional,
        'token': this.config.token,
      },
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

    const response = await this.requestWithRetry(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'nomeRelacional': this.config.nomeRelacional,
        'token': this.config.token,
      },
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
