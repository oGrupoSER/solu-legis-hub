/**
 * SOAP Client for Solucionare WebServices
 * Handles SOAP envelope construction and XML parsing
 */

export interface SoapConfig {
  serviceUrl: string;
  nomeRelacional: string;
  token: string;
}

export class SoapClient {
  private config: SoapConfig;

  constructor(config: SoapConfig) {
    this.config = config;
  }

  /**
   * Build SOAP envelope for request
   */
  private buildEnvelope(method: string, params: Record<string, any>): string {
    const paramsXml = Object.entries(params)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `<${key}>${JSON.stringify(value)}</${key}>`;
        }
        return `<${key}>${this.escapeXml(String(value))}</${key}>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="http://tempuri.org/">
      <nomeRelacional>${this.escapeXml(this.config.nomeRelacional)}</nomeRelacional>
      <token>${this.escapeXml(this.config.token)}</token>
      ${paramsXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Normalize service URL by removing .wsdl or ?wsdl
   */
  private getNormalizedUrl(): string {
    let url = this.config.serviceUrl;
    
    // Remove .wsdl extension
    if (url.endsWith('.wsdl')) {
      url = url.substring(0, url.length - 5);
    }
    
    // Remove ?wsdl query parameter
    if (url.includes('?wsdl')) {
      url = url.split('?wsdl')[0];
    }
    
    return url;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Parse SOAP response
   */
  private parseResponse(xmlText: string, method: string): any {
    try {
      console.log('=== SOAP Response Parsing ===');
      console.log('Method:', method);
      console.log('Raw XML (first 500 chars):', xmlText.substring(0, 500));
      
      // Remove namespaces and extra attributes for easier parsing
      const cleanXml = xmlText
        .replace(/<[A-Za-z0-9_]+:/g, '<')
        .replace(/<\/[A-Za-z0-9_]+:/g, '</')
        .replace(/xmlns[^=]*="[^"]*"\s*/g, '')
        .replace(/\s+>/g, '>')
        .trim();

      console.log('Clean XML (first 500 chars):', cleanXml.substring(0, 500));

      // Try multiple patterns for the result with optional namespace prefix
      const patterns = [
        new RegExp(`<(?:\\w+:)?${method}Result>(.*?)</(?:\\w+:)?${method}Result>`, 's'),
        new RegExp(`<(?:\\w+:)?${method}Response[^>]*>(.*?)</(?:\\w+:)?${method}Response>`, 's'),
        new RegExp(`<(?:\\w+:)?return>(.*?)</(?:\\w+:)?return>`, 's'),
        // Fallback: try to find any <string> elements in response
        new RegExp(`<Body[^>]*>(.*?)</Body>`, 's')
      ];

      let resultXml = '';
      for (const pattern of patterns) {
        const match = cleanXml.match(pattern);
        if (match) {
          resultXml = match[1].trim();
          console.log('Match found with pattern:', pattern.source);
          console.log('Result XML:', resultXml.substring(0, 300));
          break;
        }
      }

      if (!resultXml) {
        console.error('No result pattern matched. Full clean XML:', cleanXml);
        throw new Error(`No result found for method ${method}`);
      }

      // Try to parse as JSON if it looks like JSON
      if (resultXml.startsWith('{') || resultXml.startsWith('[')) {
        try {
          const parsed = JSON.parse(resultXml);
          console.log('Parsed as JSON:', parsed);
          return parsed;
        } catch {
          console.log('Failed to parse as JSON, returning as string');
          return resultXml;
        }
      }

      // Parse XML arrays (escritorios, nomes)
      if (resultXml.includes('<string>')) {
        const items: string[] = [];
        const stringRegex = /<string>(.*?)<\/string>/gs;
        let stringMatch;
        while ((stringMatch = stringRegex.exec(resultXml)) !== null) {
          const value = stringMatch[1].trim();
          if (value) {
            items.push(value);
          }
        }
        console.log(`Extracted ${items.length} string items:`, items.slice(0, 5));
        return items;
      }

      // If it's empty or whitespace only, return empty array
      if (!resultXml || resultXml.trim() === '') {
        console.log('Empty result, returning empty array');
        return [];
      }

      // Otherwise return as XML string
      console.log('Returning raw result XML');
      return resultXml;
    } catch (error) {
      console.error('=== SOAP Parsing Error ===');
      console.error('Error:', error);
      console.error('Full XML Response:', xmlText);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse SOAP response: ${message}`);
    }
  }

  /**
   * Make SOAP request
   */
  async call(method: string, params: Record<string, any> = {}): Promise<any> {
    const envelope = this.buildEnvelope(method, params);
    const normalizedUrl = this.getNormalizedUrl();
    
    console.log('=== SOAP Request ===');
    console.log(`Original URL: ${this.config.serviceUrl}`);
    console.log(`Normalized URL: ${normalizedUrl}`);
    console.log(`Method: ${method}`);
    console.log('Envelope (first 500 chars):', envelope.substring(0, 500));

    try {
      const response = await fetch(normalizedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `http://tempuri.org/${method}`,
        },
        body: envelope,
      });

      console.log('=== SOAP HTTP Response ===');
      console.log('Status:', response.status, response.statusText);
      console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText.substring(0, 1000));
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('Response length:', responseText.length);
      
      return this.parseResponse(responseText, method);
    } catch (error) {
      console.error('=== SOAP Request Failed ===');
      console.error(`Method: ${method}`);
      console.error('Error:', error);
      throw error;
    }
  }
}
