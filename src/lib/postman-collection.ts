/**
 * Postman Collection v2.1 generator for Hub Jurídico API
 */

const BASE_URL_VAR = '{{base_url}}';
const TOKEN_VAR = '{{api_token}}';
const JWT_VAR = '{{jwt_token}}';

interface PostmanRequest {
  name: string;
  method: string;
  description: string;
  path: string;
  queryParams?: Array<{ key: string; value: string; description: string; disabled?: boolean }>;
  body?: any;
  authType?: 'token' | 'jwt';
}

function buildRequest(item: PostmanRequest) {
  const urlParts = item.path.split('?');
  const pathSegments = urlParts[0].split('/').filter(Boolean);
  const authValue = item.authType === 'jwt' ? `Bearer ${JWT_VAR}` : `Bearer ${TOKEN_VAR}`;

  return {
    name: item.name,
    request: {
      method: item.method,
      header: [
        { key: 'Authorization', value: authValue, type: 'text' },
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
  // ─── PROCESSOS ──────────────────────────────────────
  const processesQueryFolder = {
    name: '🔍 Consulta',
    item: [
      buildRequest({
        name: 'Listar Processos', method: 'GET', path: 'api-processes',
        description: 'Retorna lista de processos vinculados ao cliente do token. Máximo 500 por lote.',
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
      buildRequest({ name: 'Detalhe do Processo', method: 'GET', path: 'api-processes', description: 'Retorna detalhes de um processo específico', queryParams: [{ key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo (UUID)' }] }),
      buildRequest({ name: 'Processo com Movimentações', method: 'GET', path: 'api-processes', description: 'Retorna processo com movimentações', queryParams: [{ key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo' }, { key: 'include', value: 'movements', description: 'Incluir movimentações' }] }),
      buildRequest({ name: 'Processo com Documentos', method: 'GET', path: 'api-processes', description: 'Retorna processo com documentos', queryParams: [{ key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo' }, { key: 'include', value: 'documents', description: 'Incluir documentos' }] }),
      buildRequest({ name: 'Processo com Partes', method: 'GET', path: 'api-processes', description: 'Retorna processo com partes e advogados', queryParams: [{ key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo' }, { key: 'include', value: 'parties', description: 'Incluir partes' }] }),
      buildRequest({ name: 'Processo com Capa', method: 'GET', path: 'api-processes', description: 'Retorna processo com dados da capa', queryParams: [{ key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo' }, { key: 'include', value: 'cover', description: 'Incluir capa' }] }),
      buildRequest({ name: 'Processo Completo', method: 'GET', path: 'api-processes', description: 'Retorna processo com todos os sub-recursos', queryParams: [{ key: 'id', value: 'UUID_DO_PROCESSO', description: 'ID do processo' }, { key: 'include', value: 'movements,documents,parties,cover,groupers', description: 'Todos os sub-recursos' }] }),
      buildRequest({ name: 'Confirmar Lote de Processos', method: 'POST', path: 'api-processes?action=confirm', description: 'Confirma recebimento do último lote de processos.' }),
    ],
  };

  const processesManagementFolder = {
    name: '⚙️ Gerenciamento',
    item: [
      buildRequest({
        name: 'Cadastrar Processo', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Cadastra um novo processo CNJ para monitoramento.\n\nCampos obrigatórios: action, serviceId, processNumber, instance\nCampos opcionais: uf, codTribunal, comarca, autor, reu, clientSystemId',
        body: { action: 'register', serviceId: 'UUID_DO_SERVICO', processNumber: '0000000-00.0000.0.00.0000', instance: 1, uf: 'SP', codTribunal: 8, comarca: 'São Paulo', autor: 'Nome do Autor', reu: 'Nome do Réu', clientSystemId: 'UUID_DO_CLIENTE' },
      }),
      buildRequest({
        name: 'Excluir Processo', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Remove um processo do monitoramento.\n\nCampos obrigatórios: action, serviceId, processNumber',
        body: { action: 'delete', serviceId: 'UUID_DO_SERVICO', processNumber: '0000000-00.0000.0.00.0000' },
      }),
      buildRequest({
        name: 'Status do Processo', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Consulta o status de cadastro de um processo.\n\nCampos obrigatórios: action, serviceId, processNumber',
        body: { action: 'status', serviceId: 'UUID_DO_SERVICO', processNumber: '0000000-00.0000.0.00.0000' },
      }),
      buildRequest({
        name: 'Listar Processos Cadastrados', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Lista todos os processos cadastrados em um serviço.\n\nCampos obrigatórios: action, serviceId',
        body: { action: 'list', serviceId: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Reenviar Pendentes', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Reenvia processos com status pendente ou erro.\n\nCampos obrigatórios: action, serviceId',
        body: { action: 'send-pending', serviceId: 'UUID_DO_SERVICO' },
      }),
    ],
  };

  const processesFolder = {
    name: '📂 Processos',
    description: 'Endpoints para consulta e gerenciamento de processos judiciais',
    item: [processesQueryFolder, processesManagementFolder],
  };

  // ─── DISTRIBUIÇÕES ──────────────────────────────────
  const distributionsQueryFolder = {
    name: '🔍 Consulta',
    item: [
      buildRequest({
        name: 'Listar Distribuições', method: 'GET', path: 'api-distributions',
        description: 'Retorna distribuições vinculadas aos termos de busca do cliente. Máximo 500 por lote.',
        queryParams: [
          { key: 'limit', value: '500', description: 'Máximo de registros (1-500)' },
          { key: 'offset', value: '0', description: 'Deslocamento para paginação' },
          { key: 'termo', value: '', description: 'Filtrar por termo', disabled: true },
          { key: 'tribunal', value: '', description: 'Filtrar por tribunal', disabled: true },
          { key: 'data_inicial', value: '', description: 'Data inicial (YYYY-MM-DD)', disabled: true },
          { key: 'data_final', value: '', description: 'Data final (YYYY-MM-DD)', disabled: true },
        ],
      }),
      buildRequest({ name: 'Detalhe da Distribuição', method: 'GET', path: 'api-distributions', description: 'Retorna detalhes de uma distribuição específica', queryParams: [{ key: 'id', value: 'UUID_DA_DISTRIBUICAO', description: 'ID da distribuição (UUID)' }] }),
      buildRequest({ name: 'Confirmar Lote de Distribuições', method: 'POST', path: 'api-distributions?action=confirm', description: 'Confirma recebimento do último lote de distribuições.' }),
    ],
  };

  const distributionsManagementFolder = {
    name: '⚙️ Gerenciamento',
    item: [
      buildRequest({
        name: 'Cadastrar Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Cadastra um novo nome para monitoramento de distribuições.\n\nCampos obrigatórios: action, serviceId, nome\nCampos opcionais: codTipoConsulta, listInstancias, abrangencias, qtdDiasCapturaRetroativa, listDocumentos, listOab, client_system_id',
        body: { action: 'register', serviceId: 'UUID_DO_SERVICO', nome: 'Nome da Parte', codTipoConsulta: 1, listInstancias: [1, 2], abrangencias: [{ codEstado: 26 }], qtdDiasCapturaRetroativa: 30, listDocumentos: ['12345678900'], listOab: [{ numero: '12345', uf: 'SP' }] },
      }),
      buildRequest({
        name: 'Editar Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Edita um nome existente de distribuição.\n\nCampos obrigatórios: action, serviceId, termId',
        body: { action: 'edit', serviceId: 'UUID_DO_SERVICO', termId: 'UUID_DO_TERMO', nome: 'Novo Nome', codTipoConsulta: 1 },
      }),
      buildRequest({
        name: 'Ativar Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Ativa um nome de distribuição.\n\nCampos obrigatórios: action, serviceId, codNome',
        body: { action: 'activate', serviceId: 'UUID_DO_SERVICO', codNome: 12345 },
      }),
      buildRequest({
        name: 'Desativar Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Desativa um nome de distribuição.\n\nCampos obrigatórios: action, serviceId, codNome',
        body: { action: 'deactivate', serviceId: 'UUID_DO_SERVICO', codNome: 12345 },
      }),
      buildRequest({
        name: 'Excluir Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Exclui um nome de distribuição.\n\nCampos obrigatórios: action, serviceId, codNome',
        body: { action: 'delete', serviceId: 'UUID_DO_SERVICO', codNome: 12345 },
      }),
      buildRequest({
        name: 'Listar Nomes', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Lista todos os nomes cadastrados para distribuições.\n\nCampos obrigatórios: action, serviceId',
        body: { action: 'list', serviceId: 'UUID_DO_SERVICO' },
      }),
    ],
  };

  const distributionsFolder = {
    name: '📂 Distribuições',
    description: 'Endpoints para consulta e gerenciamento de distribuições',
    item: [distributionsQueryFolder, distributionsManagementFolder],
  };

  // ─── PUBLICAÇÕES ────────────────────────────────────
  const publicationsQueryFolder = {
    name: '🔍 Consulta',
    item: [
      buildRequest({
        name: 'Listar Publicações', method: 'GET', path: 'api-publications',
        description: 'Retorna publicações vinculadas aos termos do cliente. Máximo 500 por lote.',
        queryParams: [
          { key: 'limit', value: '500', description: 'Máximo de registros (1-500)' },
          { key: 'offset', value: '0', description: 'Deslocamento para paginação' },
          { key: 'termo', value: '', description: 'Filtrar por termo', disabled: true },
          { key: 'diario', value: '', description: 'Filtrar por nome do diário', disabled: true },
          { key: 'data_inicial', value: '', description: 'Data inicial (YYYY-MM-DD)', disabled: true },
          { key: 'data_final', value: '', description: 'Data final (YYYY-MM-DD)', disabled: true },
        ],
      }),
      buildRequest({ name: 'Detalhe da Publicação', method: 'GET', path: 'api-publications', description: 'Retorna detalhes de uma publicação específica', queryParams: [{ key: 'id', value: 'UUID_DA_PUBLICACAO', description: 'ID da publicação (UUID)' }] }),
      buildRequest({ name: 'Confirmar Lote de Publicações', method: 'POST', path: 'api-publications?action=confirm', description: 'Confirma recebimento do último lote de publicações.' }),
    ],
  };

  const publicationsManagementFolder = {
    name: '⚙️ Gerenciamento',
    item: [
      buildRequest({
        name: 'Cadastrar Termo', method: 'POST', path: 'manage-publication-terms', authType: 'jwt',
        description: 'Cadastra um novo termo para monitoramento de publicações.\n\nCampos obrigatórios: action, service_id, term, term_type\nCampos opcionais: variacoes, termos_bloqueio, abrangencias, oab, client_system_id',
        body: { action: 'register', service_id: 'UUID_DO_SERVICO', term: 'Nome ou Expressão', term_type: 'name', variacoes: ['João Silva', 'J. Silva'], termos_bloqueio: ['homônimo'], abrangencias: [{ codEstado: 26 }], oab: [{ numero: '12345', uf: 'SP' }] },
      }),
      buildRequest({
        name: 'Editar Termo', method: 'POST', path: 'manage-publication-terms', authType: 'jwt',
        description: 'Edita um termo existente de publicação.\n\nCampos obrigatórios: action, service_id, term_id, term, term_type',
        body: { action: 'edit', service_id: 'UUID_DO_SERVICO', term_id: 'UUID_DO_TERMO', term: 'Novo Valor', term_type: 'name' },
      }),
      buildRequest({
        name: 'Excluir Termo', method: 'POST', path: 'manage-publication-terms', authType: 'jwt',
        description: 'Exclui um termo de publicação.\n\nCampos obrigatórios: action, service_id, term_id, term_type',
        body: { action: 'delete', service_id: 'UUID_DO_SERVICO', term_id: 'UUID_DO_TERMO', term_type: 'name' },
      }),
      buildRequest({
        name: 'Listar Termos', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Lista todos os termos cadastrados para publicações.\n\nCampos obrigatórios: action, service_id, term_type',
        body: { action: 'list', service_id: 'UUID_DO_SERVICO', term_type: 'name' },
      }),
    ],
  };

  const publicationsFolder = {
    name: '📂 Publicações',
    description: 'Endpoints para consulta e gerenciamento de publicações de diários oficiais',
    item: [publicationsQueryFolder, publicationsManagementFolder],
  };

  return {
    info: {
      name: 'Hub Jurídico - API',
      description: 'Coleção completa da API do Hub Jurídico para consumo e gerenciamento de processos, distribuições e publicações.\n\n## Autenticação\n\n### Endpoints de Consulta\nRequerem um token Bearer customizado (obtido via painel do Hub Jurídico).\n\n### Endpoints de Gerenciamento\nRequerem JWT do usuário autenticado (Supabase Auth).\n\n## Controle de Volumetria\nOs dados são entregues em lotes de até 500 registros. Após receber um lote, é necessário confirmar o recebimento via POST antes de solicitar novos dados.\n\n## Rate Limit\nPadrão: 1000 requisições/hora por token. Verifique os headers X-RateLimit-* na resposta.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'base_url', value: baseUrl, type: 'string' },
      { key: 'api_token', value: 'SEU_TOKEN_AQUI', type: 'string' },
      { key: 'jwt_token', value: 'SEU_JWT_AQUI', type: 'string' },
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
