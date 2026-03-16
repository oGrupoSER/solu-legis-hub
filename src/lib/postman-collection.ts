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
    name: '⚙️ Gerenciamento (REST)',
    item: [
      buildRequest({
        name: 'Cadastrar Termo', method: 'POST', path: 'manage-publication-terms', authType: 'jwt',
        description: 'Cadastra um novo termo para monitoramento de publicações.',
        body: { action: 'register', service_id: 'UUID_DO_SERVICO', term: 'Nome ou Expressão', term_type: 'name', variacoes: ['João Silva', 'J. Silva'], termos_bloqueio: ['homônimo'], abrangencias: [{ codEstado: 26 }], oab: [{ numero: '12345', uf: 'SP' }] },
      }),
      buildRequest({
        name: 'Editar Termo', method: 'POST', path: 'manage-publication-terms', authType: 'jwt',
        description: 'Edita um termo existente de publicação.',
        body: { action: 'edit', service_id: 'UUID_DO_SERVICO', term_id: 'UUID_DO_TERMO', term: 'Novo Valor', term_type: 'name' },
      }),
      buildRequest({
        name: 'Excluir Termo', method: 'POST', path: 'manage-publication-terms', authType: 'jwt',
        description: 'Exclui um termo de publicação.',
        body: { action: 'delete', service_id: 'UUID_DO_SERVICO', term_id: 'UUID_DO_TERMO', term_type: 'name' },
      }),
      buildRequest({
        name: 'Listar Termos', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Lista todos os termos cadastrados para publicações.',
        body: { action: 'list', service_id: 'UUID_DO_SERVICO', term_type: 'name' },
      }),
    ],
  };

  const publicationsSoapFolder = {
    name: '⚙️ Gerenciamento (SOAP)',
    item: [
      buildRequest({
        name: 'Cadastrar Nome (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Cadastra um novo nome de pesquisa via SOAP.',
        body: { action: 'cadastrar_nome', service_id: 'UUID_DO_SERVICO', data: { nome: 'Nome a cadastrar', variacoes: ['J. Silva'], abrangencias: ['DJE'] } },
      }),
      buildRequest({
        name: 'Editar Nome (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Edita um nome existente via SOAP.',
        body: { action: 'editar_nome', service_id: 'UUID_DO_SERVICO', data: { cod_nome: 12345, nome: 'Nome Atualizado', variacoes: ['J. Silva'] } },
      }),
      buildRequest({
        name: 'Ativar Nome (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Ativa um nome de pesquisa via SOAP.',
        body: { action: 'ativar_nome', service_id: 'UUID_DO_SERVICO', data: { cod_nome: 12345 } },
      }),
      buildRequest({
        name: 'Desativar Nome (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Desativa um nome de pesquisa via SOAP.',
        body: { action: 'desativar_nome', service_id: 'UUID_DO_SERVICO', data: { cod_nome: 12345 } },
      }),
      buildRequest({
        name: 'Excluir Nome (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Exclui um nome de pesquisa via SOAP.',
        body: { action: 'excluir_nome', service_id: 'UUID_DO_SERVICO', data: { cod_nome: 12345 } },
      }),
      buildRequest({
        name: 'Excluir Nome (REST V2)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Exclui um nome de pesquisa via REST V2.',
        body: { action: 'excluir_nome_rest', service_id: 'UUID_DO_SERVICO', data: { cod_nome: 12345 } },
      }),
      buildRequest({
        name: 'Cadastrar Escritório (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Cadastra um escritório via SOAP.',
        body: { action: 'cadastrar_escritorio', service_id: 'UUID_DO_SERVICO', data: { escritorio: 'Escritório XYZ', cod_escritorio: 41 } },
      }),
      buildRequest({
        name: 'Ativar Escritório (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Ativa um escritório via SOAP.',
        body: { action: 'ativar_escritorio', service_id: 'UUID_DO_SERVICO', data: { cod_escritorio: 41 } },
      }),
      buildRequest({
        name: 'Desativar Escritório (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Desativa um escritório via SOAP.',
        body: { action: 'desativar_escritorio', service_id: 'UUID_DO_SERVICO', data: { cod_escritorio: 41 } },
      }),
      buildRequest({
        name: 'Listar Nomes (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Lista todos os nomes cadastrados via SOAP.',
        body: { action: 'listar_nomes', service_id: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Listar Escritórios (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Lista escritórios cadastrados via SOAP.',
        body: { action: 'listar_escritorios', service_id: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Sincronizar Tudo (SOAP)', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Sincroniza todos os nomes e escritórios.',
        body: { action: 'sync_all', service_id: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Gerar Variações', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Gera variações automáticas de um nome.',
        body: { action: 'gerar_variacoes', service_id: 'UUID_DO_SERVICO', data: { nome: 'Nome para variações' } },
      }),
      buildRequest({
        name: 'Buscar Abrangências', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Busca diários/abrangências disponíveis.',
        body: { action: 'buscar_abrangencias', service_id: 'UUID_DO_SERVICO' },
      }),
      buildRequest({
        name: 'Visualizar Nome', method: 'POST', path: 'manage-search-terms', authType: 'jwt',
        description: 'Visualiza configuração completa de um nome.',
        body: { action: 'visualizar_nome', service_id: 'UUID_DO_SERVICO', data: { cod_nome: 12345 } },
      }),
    ],
  };

  const publicationsFolder = {
    name: '📂 Publicações',
    description: 'Endpoints para consulta e gerenciamento de publicações de diários oficiais',
    item: [publicationsQueryFolder, publicationsManagementFolder, publicationsSoapFolder],
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
