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
      // Remove namespaces for easier parsing
      const cleanXml = xmlText
        .replace(/<soap:/g, '<')
        .replace(/<\/soap:/g, '</')
        .replace(/xmlns[^>]*>/g, '>');

      // Extract result from method response
      const resultRegex = new RegExp(`<${method}Result>(.*?)<\/${method}Result>`, 's');
      const match = cleanXml.match(resultRegex);

      if (!match) {
        throw new Error(`No result found for method ${method}`);
      }

      const resultXml = match[1];

      // Try to parse as JSON if it looks like JSON
      if (resultXml.trim().startsWith('{') || resultXml.trim().startsWith('[')) {
        try {
          return JSON.parse(resultXml);
        } catch {
          return resultXml;
        }
      }

      // Otherwise return as XML string
      return resultXml;
    } catch (error) {
      console.error('Error parsing SOAP response:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse SOAP response: ${message}`);
    }
  }

  /**
   * Make SOAP request
   */
  async call(method: string, params: Record<string, any> = {}): Promise<any> {
    const envelope = this.buildEnvelope(method, params);
    
    console.log(`SOAP Request to ${this.config.serviceUrl}`);
    console.log(`Method: ${method}`);

    try {
      const response = await fetch(this.config.serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `http://tempuri.org/${method}`,
        },
        body: envelope,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      return this.parseResponse(responseText, method);
    } catch (error) {
      console.error(`SOAP call failed for ${method}:`, error);
      throw error;
    }
  }
}
