/**
 * Postman Collection v2.1 generator for Hub Jurídico API
 */

const BASE_URL_VAR = '{{base_url}}';
const TOKEN_VAR = '{{api_token}}';

interface PostmanRequest {
  name: string;
  method: string;
  description: string;
  path: string;
  queryParams?: Array<{ key: string; value: string; description: string; disabled?: boolean }>;
  body?: any;
}

function buildRequest(item: PostmanRequest) {
  const urlParts = item.path.split('?');
  const pathSegments = urlParts[0].split('/').filter(Boolean);

  return {
    name: item.name,
    request: {
      method: item.method,
      header: [
        { key: 'Authorization', value: `Bearer ${TOKEN_VAR}`, type: 'text' },
        { key: 'Content-Type', value: 'application/json', type: 'text' },
      ],
      url: {
        raw: `${BASE_URL_VAR}/functions/v1/${item.path}`,
        host: [`${BASE_URL_VAR}`],
        path: ['functions', 'v1', ...pathSegments],
        query: item.queryParams || [],
      },
      body: item.body ? {
        mode: 'raw',
        raw: JSON.stringify(item.body, null, 2),
      } : undefined,
      description: item.description,
    },
    response: [],
  };
}

export function generatePostmanCollection(baseUrl: string) {
  const processesFolder = {
    name: '📂 Processos',
    description: 'Endpoints para consulta de processos judiciais',
    item: [
      buildRequest({
        name: 'Listar Processos',
        method: 'GET',
        description: 'Retorna lista de processos vinculados ao cliente do token. Máximo 500 por lote. Requer confirmação antes de novo lote.',
        path: 'api-processes',
        queryParams: [
          { key: 'limit', value: '500', description: 'Máximo de registros (1-500)' },
          { key: 'offset', value: '0', description: 'Deslocamento para paginação' },
          { key: 'numero', value: '', description: 'Filtrar por número do processo', disabled: true },
          { key: 'tribunal', value: '', description: 'Filtrar por tribunal', disabled: true },
          { key: 'instancia', value: '', description: 'Filtrar por instância', disabled: true },
          { key: 'status', value: '', description: 'Filtrar por status', disabled: true },
          { key: 'uf', value: '', description: 'Filtrar por UF', disabled: true },
        ],
      }),
      buildRequest({
        name: 'Detalhe do Processo',
        method: 'GET',
        description: 'Retorna detalhes de um processo específico',
        path: 'api-processes',
        queryParams: [
          { key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo (UUID)' },
        ],
      }),
      buildRequest({
        name: 'Processo com Movimentações',
        method: 'GET',
        description: 'Retorna processo com todas as movimentações',
        path: 'api-processes',
        queryParams: [
          { key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo (UUID)' },
          { key: 'include', value: 'movements', description: 'Incluir movimentações' },
        ],
      }),
      buildRequest({
        name: 'Processo com Documentos',
        method: 'GET',
        description: 'Retorna processo com documentos disponíveis no storage',
        path: 'api-processes',
        queryParams: [
          { key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo (UUID)' },
          { key: 'include', value: 'documents', description: 'Incluir documentos' },
        ],
      }),
      buildRequest({
        name: 'Processo com Partes',
        method: 'GET',
        description: 'Retorna processo com partes e advogados',
        path: 'api-processes',
        queryParams: [
          { key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo (UUID)' },
          { key: 'include', value: 'parties', description: 'Incluir partes' },
        ],
      }),
      buildRequest({
        name: 'Processo com Capa',
        method: 'GET',
        description: 'Retorna processo com dados da capa',
        path: 'api-processes',
        queryParams: [
          { key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo (UUID)' },
          { key: 'include', value: 'cover', description: 'Incluir capa' },
        ],
      }),
      buildRequest({
        name: 'Processo Completo',
        method: 'GET',
        description: 'Retorna processo com todos os sub-recursos',
        path: 'api-processes',
        queryParams: [
          { key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo (UUID)' },
          { key: 'include', value: 'movements,documents,parties,cover,groupers', description: 'Todos os sub-recursos' },
        ],
      }),
      buildRequest({
        name: 'Confirmar Lote de Processos',
        method: 'POST',
        description: 'Confirma o recebimento do último lote de processos. Necessário para liberar novos registros.',
        path: 'api-processes?action=confirm',
      }),
    ],
  };

  const distributionsFolder = {
    name: '📂 Distribuições',
    description: 'Endpoints para consulta de distribuições',
    item: [
      buildRequest({
        name: 'Listar Distribuições',
        method: 'GET',
        description: 'Retorna distribuições vinculadas aos termos de busca do cliente. Máximo 500 por lote.',
        path: 'api-distributions',
        queryParams: [
          { key: 'limit', value: '500', description: 'Máximo de registros (1-500)' },
          { key: 'offset', value: '0', description: 'Deslocamento para paginação' },
          { key: 'termo', value: '', description: 'Filtrar por termo', disabled: true },
          { key: 'tribunal', value: '', description: 'Filtrar por tribunal', disabled: true },
          { key: 'data_inicial', value: '', description: 'Data inicial (YYYY-MM-DD)', disabled: true },
          { key: 'data_final', value: '', description: 'Data final (YYYY-MM-DD)', disabled: true },
        ],
      }),
      buildRequest({
        name: 'Detalhe da Distribuição',
        method: 'GET',
        description: 'Retorna detalhes de uma distribuição específica',
        path: 'api-distributions',
        queryParams: [
          { key: 'id', value: 'UUID_DA_DISTRIBUICAO', description: 'ID da distribuição (UUID)' },
        ],
      }),
      buildRequest({
        name: 'Confirmar Lote de Distribuições',
        method: 'POST',
        description: 'Confirma recebimento do último lote de distribuições.',
        path: 'api-distributions?action=confirm',
      }),
    ],
  };

  const publicationsFolder = {
    name: '📂 Publicações',
    description: 'Endpoints para consulta de publicações de diários oficiais',
    item: [
      buildRequest({
        name: 'Listar Publicações',
        method: 'GET',
        description: 'Retorna publicações vinculadas aos termos do cliente. Máximo 500 por lote.',
        path: 'api-publications',
        queryParams: [
          { key: 'limit', value: '500', description: 'Máximo de registros (1-500)' },
          { key: 'offset', value: '0', description: 'Deslocamento para paginação' },
          { key: 'termo', value: '', description: 'Filtrar por termo', disabled: true },
          { key: 'diario', value: '', description: 'Filtrar por nome do diário', disabled: true },
          { key: 'data_inicial', value: '', description: 'Data inicial (YYYY-MM-DD)', disabled: true },
          { key: 'data_final', value: '', description: 'Data final (YYYY-MM-DD)', disabled: true },
        ],
      }),
      buildRequest({
        name: 'Detalhe da Publicação',
        method: 'GET',
        description: 'Retorna detalhes de uma publicação específica',
        path: 'api-publications',
        queryParams: [
          { key: 'id', value: 'UUID_DA_PUBLICACAO', description: 'ID da publicação (UUID)' },
        ],
      }),
      buildRequest({
        name: 'Confirmar Lote de Publicações',
        method: 'POST',
        description: 'Confirma recebimento do último lote de publicações.',
        path: 'api-publications?action=confirm',
      }),
    ],
  };

  return {
    info: {
      name: 'Hub Jurídico - API',
      description: 'Coleção completa da API do Hub Jurídico para consumo de processos, distribuições e publicações.\n\n## Autenticação\nTodas as requisições requerem um token Bearer no header Authorization.\n\n## Controle de Volumetria\nOs dados são entregues em lotes de até 500 registros. Após receber um lote, é necessário confirmar o recebimento via POST antes de solicitar novos dados.\n\n## Rate Limit\nPadrão: 1000 requisições/hora por token. Verifique os headers X-RateLimit-* na resposta.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'base_url', value: baseUrl, type: 'string' },
      { key: 'api_token', value: 'SEU_TOKEN_AQUI', type: 'string' },
    ],
    item: [processesFolder, distributionsFolder, publicationsFolder],
  };
}

export function downloadPostmanCollection(baseUrl: string) {
  const collection = generatePostmanCollection(baseUrl);
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hub-juridico-api.postman_collection.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
