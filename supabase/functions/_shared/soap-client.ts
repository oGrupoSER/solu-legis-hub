/**
 * SOAP Client for Solucionare WebServices
 * Handles SOAP envelope construction, XML parsing, and API call logging
 * Supports complex nested XML structures for NomePesquisa objects
 */

import { Logger } from './logger.ts';

export interface SoapConfig {
  serviceUrl: string;
  nomeRelacional: string;
  token: string;
  namespace?: string;
}

export class SoapClient {
  private config: SoapConfig;
  private logger: Logger | null = null;

  constructor(config: SoapConfig) {
    this.config = config;
  }

  /** Attach a Logger instance for API call logging */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Build XML for a complex parameter value (objects, arrays, primitives).
   * Handles nested structures like NomePesquisa with variacoes, termosBloqueio, abrangencia.
   */
  private buildComplexParam(key: string, value: any): string {
    if (value === null || value === undefined) return '';
    
    if (Array.isArray(value)) {
      // Array: wrap each element
      // For arrays of objects, wrap in <item>
      // For arrays of primitives (strings), wrap in <string>
      const items = value.map(item => {
        if (typeof item === 'object' && item !== null) {
          const innerXml = Object.entries(item)
            .map(([k, v]) => this.buildComplexParam(k, v))
            .join('');
          return `<item>${innerXml}</item>`;
        } else {
          return `<string>${this.escapeXml(String(item))}</string>`;
        }
      }).join('');
      return `<${key}>${items}</${key}>`;
    }
    
    if (typeof value === 'object') {
      // Object: recursively build child elements
      const innerXml = Object.entries(value)
        .map(([k, v]) => this.buildComplexParam(k, v))
        .join('');
      return `<${key}>${innerXml}</${key}>`;
    }
    
    // Primitive value
    if (typeof value === 'boolean') {
      return `<${key}>${value}</${key}>`;
    }
    return `<${key}>${this.escapeXml(String(value))}</${key}>`;
  }

  private buildEnvelope(method: string, params: Record<string, any>): string {
    const namespace = this.config.namespace || this.getNormalizedUrl();
    
    const paramsXml = Object.entries(params)
      .map(([key, value]) => {
        // Complex types (objects/arrays) use buildComplexParam
        if (typeof value === 'object' && value !== null) {
          return this.buildComplexParam(key, value);
        }
        // Simple types use typed attributes
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

  private getNormalizedUrl(): string {
    let url = this.config.serviceUrl;
    if (url.endsWith('.wsdl')) {
      url = url.substring(0, url.length - 5);
    }
    if (url.includes('?wsdl')) {
      url = url.split('?wsdl')[0];
    }
    return url;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private parseResponse(xmlText: string, method: string): any {
    try {
      console.log('=== SOAP Response Parsing ===');
      console.log('Method:', method);
      console.log('Raw XML (first 1000 chars):', xmlText.substring(0, 1000));
      
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

      const bodyMatch = cleanXml.match(/<Body>(.*?)<\/Body>/s);
      if (!bodyMatch) {
        throw new Error('No SOAP Body found in response');
      }

      const bodyContent = bodyMatch[1];
      console.log('Body content (first 500 chars):', bodyContent.substring(0, 500));

      const retornoSection = bodyContent.match(/<retorno(?:\s[^>]*)?>([\s\S]*?)<\/retorno>/);
      if (retornoSection) {
        console.log('Parsing complex array structure within <retorno>');
        return this.parseComplexArray(retornoSection[1]);
      }

      // Check for <return> with complex content (getNomePesquisa returns object)
      const returnSection = bodyContent.match(/<return(?:\s[^>]*)?>([\s\S]*?)<\/return>/);
      if (returnSection) {
        const returnContent = returnSection[1];
        // If it contains sub-elements, parse as complex object
        if (returnContent.includes('<') && !returnContent.match(/^[^<]*$/)) {
          console.log('Parsing complex return object');
          return this.parseComplexObject(returnContent);
        }
        // Simple string return
        return returnContent.trim();
      }

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
   * Parse a complex XML object (not an array) into a JS object.
   * Handles nested arrays (variacoes, termosBloqueio, abrangencia).
   */
  private parseComplexObject(xml: string): any {
    const obj: any = {};
    
    // Extract simple fields first
    const fieldRegex = /<([a-zA-Z]+)>([^<]*)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(xml)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldValue = fieldMatch[2].trim();
      if (/^\d+$/.test(fieldValue)) {
        obj[fieldName] = parseInt(fieldValue, 10);
      } else if (fieldValue === 'true' || fieldValue === 'false') {
        obj[fieldName] = fieldValue === 'true';
      } else {
        obj[fieldName] = fieldValue;
      }
    }
    
    // Extract arrays (elements containing <item> or <string> children)
    const arrayRegex = /<([a-zA-Z]+)>((?:[\s\S]*?)<(?:item|string)[^>]*>[\s\S]*?)<\/\1>/gs;
    let arrayMatch;
    while ((arrayMatch = arrayRegex.exec(xml)) !== null) {
      const arrayName = arrayMatch[1];
      const arrayContent = arrayMatch[2];
      
      if (arrayContent.includes('<item')) {
        obj[arrayName] = this.parseComplexArray(arrayContent);
      } else if (arrayContent.includes('<string>')) {
        const strings: string[] = [];
        const strRegex = /<string>(.*?)<\/string>/gs;
        let strMatch;
        while ((strMatch = strRegex.exec(arrayContent)) !== null) {
          strings.push(strMatch[1].trim());
        }
        obj[arrayName] = strings;
      }
    }
    
    return obj;
  }

  private parseComplexArray(xml: string): any[] {
    const items: any[] = [];
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    let itemMatch;
    
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemXml = itemMatch[1];
      const item: any = {};
      
      const fieldRegex = /<([a-zA-Z]+)>([^<]*)<\/\1>/g;
      let fieldMatch;
      
      while ((fieldMatch = fieldRegex.exec(itemXml)) !== null) {
        const fieldName = fieldMatch[1];
        const fieldValue = fieldMatch[2].trim();
        
        if (/^\d+$/.test(fieldValue)) {
          item[fieldName] = parseInt(fieldValue, 10);
        } else if (fieldValue === 'true' || fieldValue === 'false') {
          item[fieldName] = fieldValue === 'true';
        } else {
          item[fieldName] = fieldValue;
        }
      }
      
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

  async call(method: string, params: Record<string, any> = {}): Promise<any> {
    const envelope = this.buildEnvelope(method, params);
    const normalizedUrl = this.getNormalizedUrl();
    
    console.log('=== SOAP Request ===');
    console.log(`Original URL: ${this.config.serviceUrl}`);
    console.log(`Normalized URL: ${normalizedUrl}`);
    console.log(`Method: ${method}`);
    console.log('Envelope (first 800 chars):', envelope.substring(0, 800));

    const namespace = this.config.namespace || normalizedUrl;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `${namespace}#${method}`,
    };

    const startTime = Date.now();
    let responseStatus: number | undefined;
    let responseStatusText: string | undefined;
    let responseSummary: string | undefined;
    let errorMsg: string | undefined;

    try {
      const response = await fetch(normalizedUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: envelope,
      });

      responseStatus = response.status;
      responseStatusText = response.statusText;

      console.log('=== SOAP HTTP Response ===');
      console.log('Status:', response.status, response.statusText);
      console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      if (!response.ok) {
        const errorText = await response.text();
        errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        responseSummary = `Error: ${errorText.substring(0, 200)}`;
        console.error('Error response body:', errorText.substring(0, 1000));
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      responseSummary = `XML | ${responseText.length} bytes`;
      console.log('Response length:', responseText.length);
      
      const result = this.parseResponse(responseText, method);
      if (Array.isArray(result)) {
        responseSummary += ` | ${result.length} itens`;
      }
      return result;
    } catch (error) {
      if (!errorMsg) {
        errorMsg = error instanceof Error ? error.message : String(error);
      }
      console.error('=== SOAP Request Failed ===');
      console.error(`Method: ${method}`);
      console.error('Error:', error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      if (this.logger) {
        await this.logger.logApiCall({
          call_type: 'SOAP',
          method: `SOAP:${method}`,
          url: normalizedUrl,
          request_headers: requestHeaders,
          request_body: envelope,
          response_status: responseStatus,
          response_status_text: responseStatusText,
          response_summary: responseSummary,
          duration_ms: duration,
          error_message: errorMsg,
        });
      }
    }
  }
}
