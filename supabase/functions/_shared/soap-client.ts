/**
 * SOAP Client for Solucionare WebServices
 * Handles SOAP envelope construction and XML parsing
 */

export interface SoapConfig {
  serviceUrl: string;
  nomeRelacional: string;
  token: string;
  namespace?: string; // Custom namespace for SOAP envelope
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
    const namespace = this.config.namespace || this.getNormalizedUrl();
    
    const paramsXml = Object.entries(params)
      .map(([key, value]) => {
        const typeAttr = typeof value === 'number' ? 'xsi:type="xsd:int"' : 'xsi:type="xsd:string"';
        return `<${key} ${typeAttr}>${this.escapeXml(String(value))}</${key}>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:nom="${namespace}">
  <soapenv:Header/>
  <soapenv:Body>
    <nom:${method} soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
      <nomeRelacional xsi:type="xsd:string">${this.escapeXml(this.config.nomeRelacional)}</nomeRelacional>
      <token xsi:type="xsd:string">${this.escapeXml(this.config.token)}</token>
      ${paramsXml}
    </nom:${method}>
  </soapenv:Body>
</soapenv:Envelope>`;
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
   * Parse SOAP response - handles complex structures with nested objects
   */
  private parseResponse(xmlText: string, method: string): any {
    try {
      console.log('=== SOAP Response Parsing ===');
      console.log('Method:', method);
      console.log('Raw XML (first 1000 chars):', xmlText.substring(0, 1000));
      
      // Remove namespaces and extra attributes for easier parsing
      const cleanXml = xmlText
        .replace(/<[A-Za-z0-9_-]+:/g, '<')
        .replace(/<\/[A-Za-z0-9_-]+:/g, '</')
        .replace(/\s+xmlns[^=]*="[^"]*"/g, '')
        .replace(/\s+xsi:type="[^"]*"/g, '')
        .replace(/\s+arrayType="[^"]*"/g, '')
        .replace(/\s+encodingStyle="[^"]*"/g, '')
        .replace(/\s+>/g, '>')
        .trim();

      console.log('Clean XML (first 1000 chars):', cleanXml.substring(0, 1000));

      // Extract the response body content
      const bodyMatch = cleanXml.match(/<Body>(.*?)<\/Body>/s);
      if (!bodyMatch) {
        throw new Error('No SOAP Body found in response');
      }

      const bodyContent = bodyMatch[1];
      console.log('Body content (first 500 chars):', bodyContent.substring(0, 500));

      // Check if response contains <retorno> (with or without attributes) array structure
      const retornoSection = bodyContent.match(/<retorno(?:\s[^>]*)?>([\s\S]*?)<\/retorno>/);
      if (retornoSection) {
        console.log('Parsing complex array structure within <retorno>');
        return this.parseComplexArray(retornoSection[1]);
      }

      // Parse simple string arrays
      if (bodyContent.includes('<string>')) {
        const items: string[] = [];
        const stringRegex = /<string>(.*?)<\/string>/gs;
        let stringMatch;
        while ((stringMatch = stringRegex.exec(bodyContent)) !== null) {
          const value = stringMatch[1].trim();
          if (value) {
            items.push(value);
          }
        }
        console.log(`Extracted ${items.length} string items`);
        return items;
      }

      // If empty, return empty array
      if (!bodyContent.trim() || bodyContent.trim() === '<return/>') {
        console.log('Empty result, returning empty array');
        return [];
      }

      console.log('Returning body content as-is');
      return bodyContent;
    } catch (error) {
      console.error('=== SOAP Parsing Error ===');
      console.error('Error:', error);
      console.error('Full XML Response:', xmlText);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse SOAP response: ${message}`);
    }
  }

  /**
   * Parse complex array structures with nested objects
   */
  private parseComplexArray(xml: string): any[] {
    const items: any[] = [];
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    let itemMatch;
    
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemXml = itemMatch[1];
      const item: any = {};
      
      // Extract all simple fields
      const fieldRegex = /<([a-zA-Z]+)>([^<]*)<\/\1>/g;
      let fieldMatch;
      
      while ((fieldMatch = fieldRegex.exec(itemXml)) !== null) {
        const fieldName = fieldMatch[1];
        const fieldValue = fieldMatch[2].trim();
        
        // Try to parse as number if it looks like one
        if (/^\d+$/.test(fieldValue)) {
          item[fieldName] = parseInt(fieldValue, 10);
        } else {
          item[fieldName] = fieldValue;
        }
      }
      
      // Extract nested arrays (like variacoes)
      const arrayRegex = /<([a-zA-Z]+)>((?:.*?)<item[^>]*>.*?<\/item>(?:.*?))<\/\1>/gs;
      let arrayMatch;
      
      while ((arrayMatch = arrayRegex.exec(itemXml)) !== null) {
        const arrayName = arrayMatch[1];
        const arrayContent = arrayMatch[2];
        item[arrayName] = this.parseComplexArray(arrayContent);
      }
      
      items.push(item);
    }
    
    console.log(`Parsed ${items.length} complex items`);
    if (items.length > 0) {
      console.log('First item sample:', JSON.stringify(items[0]).substring(0, 200));
    }
    
    return items;
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
      const namespace = this.config.namespace || normalizedUrl;
      const response = await fetch(normalizedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `${namespace}#${method}`,
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
