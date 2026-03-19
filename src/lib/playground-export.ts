/**
 * Playground Export — generates a Postman Collection v2.1 with ONLY the
 * management endpoints visible in the Playground UI sidebar.
 *
 * Auto-fills:
 *   • codEscritorio → 41
 *   • serviceId / service_id → the currently-selected partner_service ID
 */

// Re-use the exact same type from ApiTesting
interface ParamDef {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}

interface EndpointDef {
  id: string;
  label: string;
  method: string;
  description: string;
  path: string;
  category: 'query' | 'management';
  authType: 'token' | 'jwt';
  params: ParamDef[];
  bodyParams?: ParamDef[];
}

// ── Constants ────────────────────────────────────────────────────
const DEFAULT_ABRANGENCIAS_EXPORT = [
  "CJM-1","CJM-10","CJM-11","CJM-12","CJM-2","CJM-3","CJM-4","CJM-5","CJM-6","CJM-7","CJM-8","CJM-9",
  "JF-AC","JF-AL","JF-AM","JF-AP","JF-BA","JF-CE","JF-DF","JF-ES","JF-GO","JF-MA","JF-MG","JF-MS","JF-MT",
  "JF-PA","JF-PB","JF-PE","JF-PI","JF-PR","JF-RJ","JF-RN","JF-RO","JF-RR","JF-RS","JF-SC","JF-SE","JF-SP","JF-TO",
  "STF","STJ",
  "TJ-AC","TJ-AL","TJ-AM","TJ-AP","TJ-BA","TJ-CE","TJ-DF","TJ-DFT","TJ-ES","TJ-GO","TJ-MA","TJ-MG",
  "TJM-MG","TJM-RS","TJ-MS","TJM-SP","TJ-MT","TJ-PA","TJ-PB","TJ-PE","TJ-PI","TJ-PR","TJ-RJ","TJ-RN","TJ-RO","TJ-RR",
  "TJ-RS","TJ-SC","TJ-SE","TJ-SP","TJ-TO",
  "TRE-AC","TRE-AL","TRE-AM","TRE-AP","TRE-BA","TRE-CE","TRE-DF","TRE-DFT","TRE-ES","TRE-GO","TRE-MA","TRE-MG",
  "TRE-MS","TRE-MT","TRE-PA","TRE-PB","TRE-PE","TRE-PI","TRE-PR","TRE-RJ","TRE-RN","TRE-RO","TRE-RR","TRE-RS",
  "TRE-SC","TRE-SE","TRE-SP","TRE-TO",
  "TRF-1","TRF-2","TRF-3","TRF-4","TRF-5","TRF-6",
  "TRT-1","TRT-10","TRT-11","TRT-12","TRT-13","TRT-14","TRT-15","TRT-16","TRT-17","TRT-18","TRT-19",
  "TRT-2","TRT-20","TRT-21","TRT-22","TRT-23","TRT-24",
  "TRT-3","TRT-4","TRT-5","TRT-6","TRT-7","TRT-8","TRT-9",
  "TSE","TST"
];

// ── Postman helpers ──────────────────────────────────────────────

const BASE_URL_VAR = '{{base_url}}';
const JWT_VAR = '{{jwt_token}}';

function buildPostmanItem(
  ep: EndpointDef,
  action: string | undefined,
  selectedServiceId: string,
) {
  const authValue = ep.authType === 'jwt' ? `Bearer ${JWT_VAR}` : `Bearer {{api_token}}`;
  const pathSegments = ep.path.split('?')[0].split('/').filter(Boolean);

  // Build body from bodyParams with auto-filled defaults
  let body: Record<string, any> | undefined;
  if (ep.bodyParams?.length || action) {
    const isSearchTerms = ep.path === 'manage-search-terms';

    if (isSearchTerms) {
      // manage-search-terms uses { action, service_id, data: { ... } }
      const data: Record<string, any> = {};
      body = {} as Record<string, any>;
      if (action) body.action = action;

      for (const p of ep.bodyParams || []) {
        const defaultVal = getDefaultValue(p, selectedServiceId);
        if (p.key.startsWith('data.')) {
          const actualKey = p.key.slice(5);
          data[actualKey] = defaultVal;
        } else {
          body[p.key] = defaultVal;
        }
      }
      if (Object.keys(data).length > 0) body.data = data;
    } else {
      body = {} as Record<string, any>;
      if (action) body.action = action;
      for (const p of ep.bodyParams || []) {
        body[p.key] = getDefaultValue(p, selectedServiceId);
      }
    }

    // Inject distribution term defaults for Postman export
    if (ep.id === 'dis-cadastrar-termo' && body) {
      body.listInstancias = [1, 2, 3];
      body.listAbrangencias = DEFAULT_ABRANGENCIAS_EXPORT;
    }
  }

  return {
    name: ep.label,
    request: {
      method: ep.method,
      header: [
        { key: 'Authorization', value: authValue, type: 'text' },
        { key: 'Content-Type', value: 'application/json', type: 'text' },
      ],
      url: {
        raw: `${BASE_URL_VAR}/functions/v1/${ep.path}`,
        host: [BASE_URL_VAR],
        path: ['functions', 'v1', ...pathSegments],
      },
      ...(body
        ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2) } }
        : {}),
      description: ep.description,
    },
    response: [],
  };
}

function getDefaultValue(p: ParamDef, selectedServiceId: string): any {
  // serviceId / service_id → selected service
  if (p.key === 'serviceId' || p.key === 'service_id') return selectedServiceId;

  // codEscritorio → 41
  if (p.key === 'codEscritorio' || p.key === 'data.codEscritorio') return 41;

  // For numbers, use placeholder as number
  if (p.type === 'number') {
    const num = Number(p.placeholder);
    return isNaN(num) ? p.placeholder : num;
  }

  // JSON arrays / objects
  if (p.placeholder.startsWith('[') || p.placeholder.startsWith('{')) {
    try { return JSON.parse(p.placeholder); } catch { return p.placeholder; }
  }

  return p.placeholder || '';
}

// ── Main export function ─────────────────────────────────────────

export async function downloadPlaygroundExport(supabaseUrl: string, selectedServiceId?: string) {
  // Dynamically import the endpoint arrays from ApiTesting
  // We duplicate them here to avoid circular deps — they're the source of truth
  const { processEndpoints, distributionEndpoints, publicationEndpoints, managementActionMap } = await import('@/pages/ApiTesting');

  const serviceId = selectedServiceId || '{{service_id}}';

  const pubMgmt = publicationEndpoints.filter((ep: EndpointDef) => ep.category === 'management');
  const disMgmt = distributionEndpoints.filter((ep: EndpointDef) => ep.category === 'management');
  const procMgmt = processEndpoints.filter((ep: EndpointDef) => ep.category === 'management');

  const collection = {
    info: {
      name: 'HUB Jurídico — Playground',
      description: 'Coleção exportada do Playground de API. Contém apenas endpoints de Gerenciamento visíveis na interface.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'base_url', value: supabaseUrl, type: 'string' },
      { key: 'jwt_token', value: '', type: 'string' },
      { key: 'api_token', value: '', type: 'string' },
      { key: 'service_id', value: serviceId, type: 'string' },
    ],
    item: [
      {
        name: '📂 Publicações — Gerenciamento',
        item: pubMgmt.map((ep: EndpointDef) =>
          buildPostmanItem(ep, managementActionMap[ep.id], serviceId),
        ),
      },
      {
        name: '📂 Distribuições — Gerenciamento',
        item: disMgmt.map((ep: EndpointDef) =>
          buildPostmanItem(ep, managementActionMap[ep.id], serviceId),
        ),
      },
      {
        name: '📂 Processos — Gerenciamento',
        item: procMgmt.map((ep: EndpointDef) =>
          buildPostmanItem(ep, managementActionMap[ep.id], serviceId),
        ),
      },
    ],
  };

  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hub-juridico-playground.postman_collection.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
