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
        description: 'Cadastra um novo processo CNJ para monitoramento.',
        body: { action: 'register', serviceId: 'UUID_DO_SERVICO', processNumber: '0000000-00.0000.0.00.0000', instance: 1, uf: 'SP', codTribunal: 8, comarca: 'São Paulo', autor: 'Nome do Autor', reu: 'Nome do Réu', clientSystemId: 'UUID_DO_CLIENTE' },
      }),
      buildRequest({
        name: 'Excluir Processo', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Remove um processo do monitoramento.',
        body: { action: 'delete', serviceId: 'UUID_DO_SERVICO', processNumber: '0000000-00.0000.0.00.0000' },
      }),
      buildRequest({
        name: 'Status do Processo', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Consulta o status de cadastro de um processo.',
        body: { action: 'status', serviceId: 'UUID_DO_SERVICO', processNumber: '0000000-00.0000.0.00.0000' },
      }),
      buildRequest({
        name: 'Listar Processos Cadastrados', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Lista todos os processos cadastrados em um serviço.',
        body: { action: 'list', serviceId: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Reenviar Pendentes', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Reenvia processos com status pendente ou erro.',
        body: { action: 'send-pending', serviceId: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Sincronizar Processos', method: 'POST', path: 'sync-process-management', authType: 'jwt',
        description: 'Sincroniza status de todos os processos + busca novos.',
        body: { action: 'sync', serviceId: 'UUID_DO_SERVICO' },
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
        description: 'Cadastra um novo nome para monitoramento de distribuições.',
        body: { action: 'registerName', serviceId: 'UUID_DO_SERVICO', nome: 'Nome da Parte', codTipoConsulta: 1, listInstancias: [1, 2], abrangencias: [{ codEstado: 26 }], qtdDiasCapturaRetroativa: 30, listDocumentos: ['12345678900'], listOab: [{ numero: '12345', uf: 'SP' }] },
      }),
      buildRequest({
        name: 'Editar Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Edita um nome existente de distribuição.',
        body: { action: 'editName', serviceId: 'UUID_DO_SERVICO', termId: 'UUID_DO_TERMO', nome: 'Novo Nome', codTipoConsulta: 1 },
      }),
      buildRequest({
        name: 'Editar Instância/Abrangência', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Edita instâncias e abrangências de um nome.',
        body: { action: 'editNameScope', serviceId: 'UUID_DO_SERVICO', codNome: 12345, instancia: 1, abrangencia: { codEstado: 26 } },
      }),
      buildRequest({
        name: 'Ativar Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Ativa um nome de distribuição.',
        body: { action: 'activateName', serviceId: 'UUID_DO_SERVICO', codNome: 12345 },
      }),
      buildRequest({
        name: 'Desativar Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Desativa um nome de distribuição.',
        body: { action: 'deactivateName', serviceId: 'UUID_DO_SERVICO', codNome: 12345 },
      }),
      buildRequest({
        name: 'Excluir Nome', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Exclui um nome de distribuição.',
        body: { action: 'deleteName', serviceId: 'UUID_DO_SERVICO', codNome: 12345 },
      }),
      buildRequest({
        name: 'Listar Nomes', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Lista todos os nomes cadastrados para distribuições.',
        body: { action: 'listNames', serviceId: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Cadastrar Escritório', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Cadastra um novo escritório para distribuições.',
        body: { action: 'registerOffice', serviceId: 'UUID_DO_SERVICO', nomeEscritorio: 'Escritório XYZ', codAbrangencia: 26 },
      }),
      buildRequest({
        name: 'Ativar Escritório', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Ativa um escritório de distribuição.',
        body: { action: 'activateOffice', serviceId: 'UUID_DO_SERVICO', codEscritorio: 41 },
      }),
      buildRequest({
        name: 'Desativar Escritório', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Desativa um escritório de distribuição.',
        body: { action: 'deactivateOffice', serviceId: 'UUID_DO_SERVICO', codEscritorio: 41 },
      }),
      buildRequest({
        name: 'Listar Escritórios Cadastrados', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Lista escritórios cadastrados (BuscaEscritoriosCadastrados).',
        body: { action: 'listScopes', serviceId: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Listar Status Sistemas', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Lista status dos sistemas de distribuição (BuscaStatusSistemas).',
        body: { action: 'listSystems', serviceId: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Listar Todos os Nomes (API)', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Lista nomes diretamente da API (BuscaNomesCadastrados).',
        body: { action: 'listAllNames', serviceId: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Listar Abrangências', method: 'POST', path: 'manage-distribution-terms', authType: 'jwt',
        description: 'Lista abrangências disponíveis para monitoramento.',
        body: { action: 'listAbrangencias', serviceId: 'UUID_DO_SERVICO' },
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
    name: '⚙️ Gerenciamento (REST V2)',
    item: [
      buildRequest({
        name: 'Pub - Autenticação', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Autentica na API REST V2 e retorna um tokenJWT.',
        body: { action: 'rest_autenticar', service_id: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Pub - Cadastrar Nome', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Cadastra um nome (termo) para monitoramento. Retorna codNome.',
        body: { action: 'rest_cadastrar_nome', service_id: 'UUID_DO_SERVICO', data: { nome: 'CHRISTIAN FERNANDES DE BARROS', codEscritorio: 41 } },
      }),
      buildRequest({
        name: 'Pub - Excluir Nome', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Exclui um nome pelo codNome.',
        body: { action: 'rest_excluir_nome', service_id: 'UUID_DO_SERVICO', data: { codNome: 636295 } },
      }),
      buildRequest({
        name: 'Pub - Consultar Nomes', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Consulta nomes por código de escritório com paginação.',
        body: { action: 'rest_consultar_nomes', service_id: 'UUID_DO_SERVICO', data: { codEscritorio: 41, codUltimoNome: 1 } },
      }),
      buildRequest({
        name: 'Pub - Cadastrar OAB', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Cadastra OAB vinculada a um codNome. Número 6 dígitos, letra "s" fixo.',
        body: { action: 'rest_cadastrar_oab', service_id: 'UUID_DO_SERVICO', data: { codNome: 637666, uf: 'RS', numero: '000000', letra: 's' } },
      }),
      buildRequest({
        name: 'Pub - Consultar OAB', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Consulta OABs vinculadas a um codNome.',
        body: { action: 'rest_consultar_oab', service_id: 'UUID_DO_SERVICO', data: { codNome: 636295, codUltimoOab: 1233 } },
      }),
      buildRequest({
        name: 'Pub - Cadastrar Variação', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Cadastra variações de um nome.',
        body: { action: 'rest_cadastrar_variacao', service_id: 'UUID_DO_SERVICO', data: { codNome: 637668, listVariacoes: ['ADMINISTRADORA GERAL DE ESTACIONAMENTOS S A'], variacaoTipoNumProcesso: true } },
      }),
      buildRequest({
        name: 'Pub - Cadastrar TermoValidação', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Cadastra termos de validação para nomes e variações.',
        body: { action: 'rest_cadastrar_termo_validacao', service_id: 'UUID_DO_SERVICO', data: { listTermosValidacaoNome: [{ codNome: 637668, termoValidacao: 'ADMINISTRADORA GERAL' }], listTermosValidacaoVariacao: [{ codVariacao: 637669, termoValidacao: 'ADMINISTRADORA GERAL' }] } },
      }),
      buildRequest({
        name: 'Pub - Cadastrar Abrangência', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Cadastra abrangências (diários) para um nome.',
        body: { action: 'rest_cadastrar_abrangencia', service_id: 'UUID_DO_SERVICO', data: { codNome: 637719, listCodDiarios: [434, 718, 526, 717, 295] } },
      }),
      buildRequest({
        name: 'Pub - Buscar Catálogo', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Busca catálogo completo de diários/abrangências disponíveis.',
        body: { action: 'rest_buscar_catalogo', service_id: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Pub - Buscar Publicações', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Busca publicações por código de escritório.',
        body: { action: 'rest_buscar_publicacoes', service_id: 'UUID_DO_SERVICO', data: { codEscritorio: 41 } },
      }),
    ],
  };

  const publicationsFolder = {
    name: '📂 Publicações',
    description: 'Endpoints para consulta e gerenciamento de publicações de diários oficiais',
    item: [publicationsQueryFolder, publicationsManagementFolder],
  };

  // ─── INTEGRAÇÃO SISTEMA-A-SISTEMA ──────────────────
  const integrationFolder = {
    name: '🔗 Integração Sistema-a-Sistema',
    description: 'Endpoints para integração via API Token (sistema-a-sistema). Usam o mesmo token dos endpoints de consulta.',
    item: [
      buildRequest({
        name: 'Cadastrar Termo Publicação', method: 'POST', path: 'api-management',
        description: 'Cadastra termo de publicação via Token. Deduplicação automática.',
        body: { action: 'register-pub-term', data: { nome: 'Nome a Monitorar', service_id: 'UUID_DO_SERVICO' } },
      }),
      buildRequest({
        name: 'Excluir Termo Publicação', method: 'POST', path: 'api-management',
        description: 'Desvincula termo de publicação. Remove da Solucionare se último cliente.',
        body: { action: 'delete-pub-term', data: { term_id: 'UUID_DO_TERMO', service_id: 'UUID_DO_SERVICO' } },
      }),
      buildRequest({
        name: 'Cadastrar Termo Distribuição', method: 'POST', path: 'api-management',
        description: 'Cadastra termo de distribuição via Token. Deduplicação automática.',
        body: { action: 'register-dist-term', data: { nome: 'Nome a Monitorar', service_id: 'UUID_DO_SERVICO', codTipoConsulta: 1, listInstancias: [1, 2], abrangencias: [{ codEstado: 26 }] } },
      }),
      buildRequest({
        name: 'Excluir Termo Distribuição', method: 'POST', path: 'api-management',
        description: 'Desvincula termo de distribuição. Remove se último cliente.',
        body: { action: 'delete-dist-term', data: { term_id: 'UUID_DO_TERMO', service_id: 'UUID_DO_SERVICO' } },
      }),
      buildRequest({
        name: 'Cadastrar Processo', method: 'POST', path: 'api-management',
        description: 'Cadastra processo para monitoramento via Token. Deduplicação automática.',
        body: { action: 'register-process', data: { processNumber: '0000000-00.0000.0.00.0000', instance: 1, uf: 'SP', service_id: 'UUID_DO_SERVICO' } },
      }),
      buildRequest({
        name: 'Excluir Processo', method: 'POST', path: 'api-management',
        description: 'Desvincula processo. Remove da Solucionare se último cliente.',
        body: { action: 'delete-process', data: { processNumber: '0000000-00.0000.0.00.0000', service_id: 'UUID_DO_SERVICO' } },
      }),
      buildRequest({
        name: 'Listar Serviços', method: 'POST', path: 'api-management',
        description: 'Lista serviços de parceiros disponíveis para o cliente.',
        body: { action: 'list-services' },
      }),
      buildRequest({
        name: 'Listar Meus Termos', method: 'POST', path: 'api-management',
        description: 'Lista termos vinculados ao cliente do token.',
        body: { action: 'list-my-terms', data: { term_type: 'name' } },
      }),
      buildRequest({
        name: 'Listar Meus Processos', method: 'POST', path: 'api-management',
        description: 'Lista processos vinculados ao cliente do token.',
        body: { action: 'list-my-processes' },
      }),
    ],
  };

  return {
    info: {
      name: 'Hub Jurídico - API',
      description: 'Coleção completa da API do Hub Jurídico para consumo e gerenciamento de processos, distribuições e publicações.\n\n## Autenticação\n\n### Endpoints de Consulta e Integração\nRequerem um token Bearer customizado (obtido via painel do Hub Jurídico).\n\n### Endpoints de Gerenciamento\nRequerem JWT do usuário autenticado (Supabase Auth).\n\n## Controle de Volumetria\nOs dados são entregues em lotes de até 500 registros. Após receber um lote, é necessário confirmar o recebimento via POST antes de solicitar novos dados.\n\n## Rate Limit\nPadrão: 1000 requisições/hora por token. Verifique os headers X-RateLimit-* na resposta.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'base_url', value: baseUrl, type: 'string' },
      { key: 'api_token', value: 'SEU_TOKEN_AQUI', type: 'string' },
      { key: 'jwt_token', value: 'SEU_JWT_AQUI', type: 'string' },
    ],
    item: [processesFolder, distributionsFolder, publicationsFolder, integrationFolder],
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
