/**
 * Playground Export - Comprehensive documentation of all HUB Jurídico API endpoints
 * Generates a structured JSON document with all endpoint definitions, action mappings,
 * auth flows, and configuration details for replication in other projects.
 */

interface PlaygroundEndpoint {
  id: string;
  label: string;
  method: string;
  description: string;
  edgeFunctionPath: string;
  actionMapping: string | null;
  authType: 'token' | 'jwt';
  category: 'query' | 'management';
  serviceCategory: 'publications' | 'distributions' | 'processes';
  params: Array<{ key: string; label: string; placeholder: string; type?: string; required?: boolean }>;
  bodyParams: Array<{ key: string; label: string; placeholder: string; type?: string; required?: boolean }>;
  exampleBody?: Record<string, any>;
}

interface PlaygroundExport {
  meta: {
    exportDate: string;
    projectName: string;
    version: string;
    description: string;
  };
  configuration: {
    baseUrl: string;
    authFlows: {
      tokenBased: {
        description: string;
        header: string;
        example: string;
      };
      jwtBased: {
        description: string;
        header: string;
        example: string;
      };
    };
    serviceTypes: Array<{ type: string; description: string; edgeFunctions: string[] }>;
  };
  edgeFunctions: Array<{
    name: string;
    path: string;
    description: string;
    authType: string;
    actions: string[];
  }>;
  endpoints: PlaygroundEndpoint[];
  actionMappings: Record<string, string>;
}

// All endpoint definitions extracted from ApiTesting.tsx
function getAllEndpoints(): PlaygroundEndpoint[] {
  const endpoints: PlaygroundEndpoint[] = [];

  // ─── PUBLICAÇÕES ─────────────────────────────────
  // Consulta
  endpoints.push({
    id: 'list-publications', label: 'Listar Publicações', method: 'GET',
    description: 'Retorna publicações de diários oficiais vinculadas aos termos do cliente. Máximo 500 por lote.',
    edgeFunctionPath: 'api-publications', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'publications',
    params: [
      { key: 'limit', label: 'Limite', placeholder: '500' },
      { key: 'offset', label: 'Offset', placeholder: '0' },
      { key: 'termo', label: 'Termo', placeholder: 'nome da parte' },
      { key: 'diario', label: 'Diário', placeholder: 'DJE' },
      { key: 'data_inicial', label: 'Data Inicial', placeholder: '2026-01-01', type: 'date' },
      { key: 'data_final', label: 'Data Final', placeholder: '2026-12-31', type: 'date' },
    ],
    bodyParams: [],
  });
  endpoints.push({
    id: 'detail-publication', label: 'Detalhe da Publicação', method: 'GET',
    description: 'Retorna detalhes de uma publicação específica.',
    edgeFunctionPath: 'api-publications', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'publications',
    params: [{ key: 'id', label: 'ID da Publicação (UUID)', placeholder: 'uuid' }],
    bodyParams: [],
  });
  endpoints.push({
    id: 'confirm-publications', label: 'Confirmar Lote', method: 'POST',
    description: 'Confirma recebimento do último lote de publicações.',
    edgeFunctionPath: 'api-publications?action=confirm', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'publications',
    params: [], bodyParams: [],
  });

  // Gerenciamento REST V2
  const pubMgmt: Array<{ id: string; label: string; method: string; action: string; description: string; bodyParams: any[]; exampleBody?: any }> = [
    { id: 'rest-autenticar', label: 'Autenticação', method: 'POST', action: 'rest_autenticar', description: 'Autentica na API REST V2 da Solucionare e retorna um tokenJWT.',
      bodyParams: [{ key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid do partner_service (tipo terms)', required: true }],
      exampleBody: { action: 'rest_autenticar', service_id: 'UUID_DO_SERVICO' },
    },
    { id: 'rest-cadastrar-nome', label: 'Cadastrar Nome', method: 'POST', action: 'rest_cadastrar_nome', description: 'Cadastra um novo nome (termo) para monitoramento de publicações. Retorna o codNome gerado.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.nome', label: 'Nome', placeholder: 'CHRISTIAN FERNANDES DE BARROS', required: true },
        { key: 'data.codEscritorio', label: 'Código do Escritório', placeholder: '41', type: 'number' },
      ],
      exampleBody: { action: 'rest_cadastrar_nome', service_id: 'UUID', data: { nome: 'NOME', codEscritorio: 41 } },
    },
    { id: 'rest-excluir-nome', label: 'Excluir Nome', method: 'POST', action: 'rest_excluir_nome', description: 'Exclui um nome (termo) pelo codNome.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.codNome', label: 'Código do Nome', placeholder: '636295', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_excluir_nome', service_id: 'UUID', data: { codNome: 636295 } },
    },
    { id: 'rest-consultar-nomes', label: 'Consultar Nomes', method: 'GET', action: 'rest_consultar_nomes', description: 'Consulta nomes cadastrados por código de escritório.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
        { key: 'data.codUltimoNome', label: 'Código Último Nome', placeholder: '1', type: 'number' },
      ],
      exampleBody: { action: 'rest_consultar_nomes', service_id: 'UUID', data: { codEscritorio: 41, codUltimoNome: 1 } },
    },
    { id: 'rest-cadastrar-oab', label: 'Cadastrar OAB', method: 'POST', action: 'rest_cadastrar_oab', description: 'Cadastra uma OAB vinculada a um codNome. Número com 6 dígitos, letra "s" fixo.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.codNome', label: 'Código do Nome', placeholder: '637666', required: true, type: 'number' },
        { key: 'data.uf', label: 'UF da OAB', placeholder: 'RS', required: true },
        { key: 'data.numero', label: 'Número da OAB', placeholder: '000000', required: true },
        { key: 'data.letra', label: 'Letra', placeholder: 's' },
      ],
      exampleBody: { action: 'rest_cadastrar_oab', service_id: 'UUID', data: { codNome: 637666, uf: 'RS', numero: '000000', letra: 's' } },
    },
    { id: 'rest-consultar-oab', label: 'Consultar OAB', method: 'GET', action: 'rest_consultar_oab', description: 'Consulta OABs vinculadas a um codNome.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.codNome', label: 'Código do Nome', placeholder: '636295', required: true, type: 'number' },
        { key: 'data.codUltimoOab', label: 'Código Última OAB', placeholder: '1233', type: 'number' },
      ],
      exampleBody: { action: 'rest_consultar_oab', service_id: 'UUID', data: { codNome: 636295, codUltimoOab: 1233 } },
    },
    { id: 'rest-cadastrar-variacao', label: 'Cadastrar Variação', method: 'POST', action: 'rest_cadastrar_variacao', description: 'Cadastra variações de um nome para ampliar o monitoramento.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.codNome', label: 'Código do Nome', placeholder: '637668', required: true, type: 'number' },
        { key: 'data.listVariacoes', label: 'Lista de Variações (JSON array)', placeholder: '["VARIACAO"]', required: true },
        { key: 'data.variacaoTipoNumProcesso', label: 'Variação Tipo Num Processo', placeholder: 'true' },
      ],
      exampleBody: { action: 'rest_cadastrar_variacao', service_id: 'UUID', data: { codNome: 637668, listVariacoes: ['VARIACAO'], variacaoTipoNumProcesso: true } },
    },
    { id: 'rest-cadastrar-termo-validacao', label: 'Cadastrar TermoValidação', method: 'POST', action: 'rest_cadastrar_termo_validacao', description: 'Cadastra termos de validação para nomes e variações.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.listTermosValidacaoNome', label: 'Termos Validação Nome (JSON)', placeholder: '[{"codNome": 637668, "termoValidacao": "TERMO"}]', required: true },
        { key: 'data.listTermosValidacaoVariacao', label: 'Termos Validação Variação (JSON)', placeholder: '[{"codVariacao": 637669, "termoValidacao": "TERMO"}]' },
      ],
      exampleBody: { action: 'rest_cadastrar_termo_validacao', service_id: 'UUID', data: { listTermosValidacaoNome: [], listTermosValidacaoVariacao: [] } },
    },
    { id: 'rest-cadastrar-abrangencia', label: 'Cadastrar Abrangência', method: 'POST', action: 'rest_cadastrar_abrangencia', description: 'Cadastra abrangências (diários) para um nome.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.codNome', label: 'Código do Nome', placeholder: '637719', required: true, type: 'number' },
        { key: 'data.listCodDiarios', label: 'Lista Códigos Diários (JSON array)', placeholder: '[434, 718, 526]', required: true },
      ],
      exampleBody: { action: 'rest_cadastrar_abrangencia', service_id: 'UUID', data: { codNome: 637719, listCodDiarios: [434, 718, 526] } },
    },
    { id: 'rest-buscar-catalogo', label: 'Buscar Catálogo', method: 'GET', action: 'rest_buscar_catalogo', description: 'Busca o catálogo completo de diários/abrangências disponíveis.',
      bodyParams: [{ key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true }],
      exampleBody: { action: 'rest_buscar_catalogo', service_id: 'UUID' },
    },
    { id: 'rest-buscar-publicacoes', label: 'Buscar Publicações', method: 'GET', action: 'rest_buscar_publicacoes', description: 'Busca publicações diretamente da API REST V2 por código de escritório.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_buscar_publicacoes', service_id: 'UUID', data: { codEscritorio: 41 } },
    },
    { id: 'rest-confirmar-recebimento', label: 'Confirmar Recebimento', method: 'POST', action: 'rest_confirmar_recebimento', description: 'Confirma recebimento de publicações na API REST V2 (publicacao_confirmarRecebimento). Envie um array JSON de IDs.',
      bodyParams: [
        { key: 'service_id', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'data.ids', label: 'IDs das Publicações (JSON array)', placeholder: '[135040011, 479125026]', required: true },
      ],
      exampleBody: { action: 'rest_confirmar_recebimento', service_id: 'UUID', data: { ids: [135040011, 479125026] } },
    },
  ];

  for (const ep of pubMgmt) {
    endpoints.push({
      id: ep.id, label: ep.label, method: ep.method,
      description: ep.description,
      edgeFunctionPath: 'manage-search-terms', actionMapping: ep.action,
      authType: 'jwt', category: 'management', serviceCategory: 'publications',
      params: [], bodyParams: ep.bodyParams,
      exampleBody: ep.exampleBody,
    });
  }

  // ─── DISTRIBUIÇÕES ─────────────────────────────────
  endpoints.push({
    id: 'list-distributions', label: 'Listar Distribuições', method: 'GET',
    description: 'Retorna distribuições vinculadas aos termos de busca do cliente. Máximo 500 por lote.',
    edgeFunctionPath: 'api-distributions', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'distributions',
    params: [
      { key: 'limit', label: 'Limite', placeholder: '500' },
      { key: 'offset', label: 'Offset', placeholder: '0' },
      { key: 'termo', label: 'Termo', placeholder: 'nome da parte' },
      { key: 'tribunal', label: 'Tribunal', placeholder: 'TJSP' },
      { key: 'data_inicial', label: 'Data Inicial', placeholder: '2026-01-01', type: 'date' },
      { key: 'data_final', label: 'Data Final', placeholder: '2026-12-31', type: 'date' },
    ],
    bodyParams: [],
  });
  endpoints.push({
    id: 'detail-distribution', label: 'Detalhe da Distribuição', method: 'GET',
    description: 'Retorna detalhes de uma distribuição específica.',
    edgeFunctionPath: 'api-distributions', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'distributions',
    params: [{ key: 'id', label: 'ID da Distribuição (UUID)', placeholder: 'uuid' }],
    bodyParams: [],
  });
  endpoints.push({
    id: 'confirm-distributions', label: 'Confirmar Lote', method: 'POST',
    description: 'Confirma recebimento do último lote de distribuições.',
    edgeFunctionPath: 'api-distributions?action=confirm', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'distributions',
    params: [], bodyParams: [],
  });

  const disMgmt: Array<{ id: string; label: string; method: string; action: string; description: string; bodyParams: any[]; exampleBody?: any }> = [
    { id: 'dis-autenticar', label: 'Autenticação', method: 'POST', action: 'rest_autenticar', description: 'Autentica na API REST V3 de Distribuições e retorna o tokenJWT.',
      bodyParams: [{ key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true }],
      exampleBody: { action: 'rest_autenticar', serviceId: 'UUID' },
    },
    { id: 'dis-cadastrar-escritorio', label: 'Cadastrar Escritório', method: 'POST', action: 'registerOffice', description: 'Cadastra um novo escritório para monitoramento de distribuições.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
        { key: 'utilizaDocumentosIniciais', label: 'Utiliza Documentos Iniciais', placeholder: '1', type: 'number' },
      ],
      exampleBody: { action: 'registerOffice', serviceId: 'UUID', codEscritorio: 41, utilizaDocumentosIniciais: 1 },
    },
    { id: 'dis-ativar-escritorio', label: 'Ativar Escritório', method: 'POST', action: 'activateOffice', description: 'Ativa um escritório de distribuição.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
      ],
      exampleBody: { action: 'activateOffice', serviceId: 'UUID', codEscritorio: 41 },
    },
    { id: 'dis-cadastrar-termo', label: 'Cadastrar Termo', method: 'POST', action: 'registerName', description: 'Cadastra um novo nome/termo para monitoramento de distribuições.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'nome', label: 'Nome', placeholder: 'VPM ESTACIONAMENTOS LTDA', required: true },
        { key: 'codTipoConsulta', label: 'Código Tipo Consulta', placeholder: '1', type: 'number' },
        { key: 'qtdDiasCapturaRetroativa', label: 'Dias Captura Retroativa', placeholder: '90', type: 'number' },
      ],
      exampleBody: { action: 'registerName', serviceId: 'UUID', nome: 'NOME', codTipoConsulta: 1, qtdDiasCapturaRetroativa: 90 },
    },
    { id: 'dis-desativar-termo', label: 'Desativar Termo', method: 'POST', action: 'deactivateName', description: 'Desativa um nome/termo de distribuição.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codNome', label: 'Código do Nome', placeholder: '41', required: true, type: 'number' },
      ],
      exampleBody: { action: 'deactivateName', serviceId: 'UUID', codNome: 41 },
    },
    { id: 'dis-buscar-distribuicoes', label: 'Buscar Distribuições', method: 'GET', action: 'rest_buscar_distribuicoes', description: 'Busca novas distribuições diretamente da API Solucionare.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', type: 'number' },
      ],
      exampleBody: { action: 'rest_buscar_distribuicoes', serviceId: 'UUID', codEscritorio: 41 },
    },
    { id: 'dis-buscar-nomes', label: 'Buscar Nomes Cadastrados', method: 'GET', action: 'listNames', description: 'Lista todos os nomes cadastrados na Solucionare.',
      bodyParams: [{ key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true }],
      exampleBody: { action: 'listNames', serviceId: 'UUID' },
    },
    { id: 'dis-confirmar-recebimento', label: 'Confirmar Recebimento', method: 'POST', action: 'confirmDistributions', description: 'Confirma recebimento de distribuições na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
        { key: 'distribuicoes', label: 'Distribuições (JSON array)', placeholder: '[{"codEscritorio": 41, "codProcesso": 195148028}]', required: true },
      ],
      exampleBody: { action: 'confirmDistributions', serviceId: 'UUID', codEscritorio: 41, distribuicoes: [{ codEscritorio: 41, codProcesso: 195148028 }] },
    },
  ];

  for (const ep of disMgmt) {
    endpoints.push({
      id: ep.id, label: ep.label, method: ep.method,
      description: ep.description,
      edgeFunctionPath: 'manage-distribution-terms', actionMapping: ep.action,
      authType: 'jwt', category: 'management', serviceCategory: 'distributions',
      params: [], bodyParams: ep.bodyParams,
      exampleBody: ep.exampleBody,
    });
  }

  // ─── PROCESSOS ─────────────────────────────────
  // Consulta
  endpoints.push({
    id: 'list-processes', label: 'Listar Processos', method: 'GET',
    description: 'Retorna lista de processos vinculados ao cliente. Máximo 500 por lote com confirmação obrigatória.',
    edgeFunctionPath: 'api-processes', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'processes',
    params: [
      { key: 'limit', label: 'Limite', placeholder: '500' },
      { key: 'offset', label: 'Offset', placeholder: '0' },
      { key: 'numero', label: 'Número do Processo', placeholder: '0000000-00.0000.0.00.0000' },
      { key: 'tribunal', label: 'Tribunal', placeholder: 'TJSP' },
      { key: 'instancia', label: 'Instância', placeholder: '1' },
      { key: 'status', label: 'Status', placeholder: 'active' },
      { key: 'uf', label: 'UF', placeholder: 'SP' },
    ],
    bodyParams: [],
  });
  endpoints.push({
    id: 'detail-process', label: 'Detalhe do Processo', method: 'GET',
    description: 'Retorna detalhes completos de um processo com sub-recursos.',
    edgeFunctionPath: 'api-processes', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'processes',
    params: [
      { key: 'id', label: 'ID do Processo (UUID)', placeholder: 'uuid' },
      { key: 'include', label: 'Incluir', placeholder: 'movements,documents,parties,cover,groupers' },
    ],
    bodyParams: [],
  });
  endpoints.push({
    id: 'confirm-processes', label: 'Confirmar Lote', method: 'POST',
    description: 'Confirma recebimento do último lote de processos.',
    edgeFunctionPath: 'api-processes?action=confirm', actionMapping: null, authType: 'token', category: 'query', serviceCategory: 'processes',
    params: [], bodyParams: [],
  });

  // Gerenciamento Processos
  const procMgmt: Array<{ id: string; label: string; method: string; action: string; description: string; bodyParams: any[]; exampleBody?: any }> = [
    { id: 'register-process', label: 'Cadastrar Processo', method: 'POST', action: 'register', description: 'Cadastra um novo processo CNJ para monitoramento.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'processNumber', label: 'Número do Processo (CNJ)', placeholder: '0000000-00.0000.0.00.0000', required: true },
        { key: 'instance', label: 'Instância', placeholder: '1', required: true },
        { key: 'uf', label: 'UF', placeholder: 'SP' },
        { key: 'codTribunal', label: 'Código do Tribunal', placeholder: '8', type: 'number' },
        { key: 'clientSystemId', label: 'ID do Sistema Cliente', placeholder: 'uuid' },
      ],
      exampleBody: { action: 'register', serviceId: 'UUID', processNumber: '0000000-00.0000.0.00.0000', instance: 1, uf: 'SP' },
    },
    { id: 'delete-process', label: 'Excluir Processo', method: 'POST', action: 'delete', description: 'Remove um processo do monitoramento.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'processNumber', label: 'Número do Processo (CNJ)', placeholder: '0000000-00.0000.0.00.0000', required: true },
      ],
      exampleBody: { action: 'delete', serviceId: 'UUID', processNumber: '0000000-00.0000.0.00.0000' },
    },
    { id: 'sync-processes', label: 'Sincronizar Processos', method: 'POST', action: 'sync', description: 'Sincroniza status de todos os processos + busca novos.',
      bodyParams: [{ key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true }],
      exampleBody: { action: 'sync', serviceId: 'UUID' },
    },
  ];

  // REST V3 Andamentos
  const restV3: Array<{ id: string; label: string; method: string; action: string; description: string; bodyParams: any[]; exampleBody?: any }> = [
    { id: 'and-cadastrar-processo', label: 'Cadastrar Processo (V3)', method: 'POST', action: 'rest_cadastrar_processo', description: 'Cadastra um novo processo na API V3 (CadastraNovoProcesso).',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
        { key: 'numProcesso', label: 'Número do Processo (CNJ)', placeholder: '0000000-00.0000.0.00.0000', required: true },
        { key: 'Instancia', label: 'Instância', placeholder: '3', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_cadastrar_processo', serviceId: 'UUID', codEscritorio: 41, numProcesso: '0000000-00.0000.0.00.0000', Instancia: 3 },
    },
    { id: 'and-excluir-processo', label: 'Excluir Processo (V3)', method: 'POST', action: 'rest_excluir_processo', description: 'Exclui um processo via API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codProcesso', label: 'Código do Processo', placeholder: '105980409', required: true, type: 'number' },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_excluir_processo', serviceId: 'UUID', codProcesso: 105980409, codEscritorio: 41 },
    },
    { id: 'and-buscar-status', label: 'Buscar Status do Processo (V3)', method: 'GET', action: 'rest_buscar_status', description: 'Busca o status de um processo na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codProcesso', label: 'Código do Processo', placeholder: '104795496', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_buscar_status', serviceId: 'UUID', codProcesso: 104795496 },
    },
    { id: 'and-buscar-agrupadores-escritorio', label: 'Buscar Agrupadores Por Escritório', method: 'GET', action: 'rest_buscar_agrupadores_escritorio', description: 'Busca agrupadores por escritório na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_buscar_agrupadores_escritorio', serviceId: 'UUID', codEscritorio: 41 },
    },
    { id: 'and-confirmar-agrupador', label: 'Confirmar Agrupador', method: 'POST', action: 'rest_confirmar_agrupador', description: 'Confirma recebimento de agrupador na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
        { key: 'codAgrupador', label: 'Código do Agrupador', placeholder: '64010523', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_confirmar_agrupador', serviceId: 'UUID', codEscritorio: 41, codAgrupador: 64010523 },
    },
    { id: 'and-buscar-andamentos-escritorio', label: 'Buscar Andamentos Por Escritório', method: 'GET', action: 'rest_buscar_andamentos_escritorio', description: 'Busca andamentos por escritório na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_buscar_andamentos_escritorio', serviceId: 'UUID', codEscritorio: 41 },
    },
    { id: 'and-confirmar-andamento', label: 'Confirmar Andamento', method: 'POST', action: 'rest_confirmar_andamento', description: 'Confirma recebimento de andamento na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
        { key: 'codAndamento', label: 'Código do Andamento', placeholder: '123', required: true, type: 'number' },
        { key: 'codProcesso', label: 'Código do Processo', placeholder: '123', required: true, type: 'number' },
        { key: 'codAgrupador', label: 'Código do Agrupador', placeholder: '123', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_confirmar_andamento', serviceId: 'UUID', codEscritorio: 41, codAndamento: 123, codProcesso: 123, codAgrupador: 123 },
    },
    { id: 'and-buscar-documentos-escritorio', label: 'Buscar Documentos Escritório', method: 'GET', action: 'rest_buscar_documentos_escritorio', description: 'Busca documentos por escritório na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_buscar_documentos_escritorio', serviceId: 'UUID', codEscritorio: 41 },
    },
    { id: 'and-confirmar-documento', label: 'Confirmar Documento', method: 'POST', action: 'rest_confirmar_documento', description: 'Confirma recebimento de documento na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
        { key: 'codDocumento', label: 'Código do Documento', placeholder: '2', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_confirmar_documento', serviceId: 'UUID', codEscritorio: 41, codDocumento: 2 },
    },
    { id: 'and-todos-andamentos-processo', label: 'Todos Andamentos por Processo', method: 'GET', action: 'rest_todos_andamentos_processo', description: 'Busca todos os andamentos de um processo na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codProcesso', label: 'Código do Processo', placeholder: '104795496', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_todos_andamentos_processo', serviceId: 'UUID', codProcesso: 104795496 },
    },
    { id: 'and-todos-documentos-processo', label: 'Todos Documentos por Processo', method: 'GET', action: 'rest_todos_documentos_processo', description: 'Busca todos os documentos de um processo na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codProcesso', label: 'Código do Processo', placeholder: '104795496', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_todos_documentos_processo', serviceId: 'UUID', codProcesso: 104795496 },
    },
    { id: 'and-buscar-capa', label: 'Buscar Capa por Processo', method: 'GET', action: 'rest_buscar_capa', description: 'Busca dados de capa de um processo na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codProcesso', label: 'Código do Processo', placeholder: '104795496', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_buscar_capa', serviceId: 'UUID', codProcesso: 104795496 },
    },
    { id: 'and-qtd-andamentos', label: 'QTD Andamentos Disponíveis', method: 'GET', action: 'rest_qtd_andamentos', description: 'Busca quantidade de andamentos disponíveis na API V3.',
      bodyParams: [
        { key: 'serviceId', label: 'ID do Serviço', placeholder: 'uuid', required: true },
        { key: 'codEscritorio', label: 'Código do Escritório', placeholder: '41', required: true, type: 'number' },
      ],
      exampleBody: { action: 'rest_qtd_andamentos', serviceId: 'UUID', codEscritorio: 41 },
    },
  ];

  for (const ep of [...procMgmt, ...restV3]) {
    endpoints.push({
      id: ep.id, label: ep.label, method: ep.method,
      description: ep.description,
      edgeFunctionPath: 'sync-process-management', actionMapping: ep.action,
      authType: 'jwt', category: 'management', serviceCategory: 'processes',
      params: [], bodyParams: ep.bodyParams,
      exampleBody: ep.exampleBody,
    });
  }

  return endpoints;
}

export function generatePlaygroundExport(baseUrl: string): PlaygroundExport {
  const endpoints = getAllEndpoints();

  // Build action mappings
  const actionMappings: Record<string, string> = {};
  for (const ep of endpoints) {
    if (ep.actionMapping) {
      actionMappings[ep.id] = ep.actionMapping;
    }
  }

  return {
    meta: {
      exportDate: new Date().toISOString(),
      projectName: 'HUB Jurídico (SoluLegisHub)',
      version: '2.0',
      description: 'Documentação completa do Playground de API do HUB Jurídico. Contém todos os endpoints, mapeamentos de ações, fluxos de autenticação e configuração para replicação em outros projetos (ex: Infojudiciais).',
    },
    configuration: {
      baseUrl: `${baseUrl}/functions/v1`,
      authFlows: {
        tokenBased: {
          description: 'Endpoints de Consulta usam token Bearer customizado obtido via painel do Hub. O token está vinculado a um client_system que define os dados acessíveis.',
          header: 'Authorization: Bearer <api_token>',
          example: 'Authorization: Bearer ljhub_biqiev2m2fi8ulzt6zie5',
        },
        jwtBased: {
          description: 'Endpoints de Gerenciamento usam JWT do Supabase Auth. Autentique-se no Supabase e use o access_token retornado.',
          header: 'Authorization: Bearer <jwt_token>',
          example: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...',
        },
      },
      serviceTypes: [
        { type: 'publications', description: 'Publicações de diários oficiais (REST V2)', edgeFunctions: ['api-publications', 'manage-search-terms', 'sync-publications'] },
        { type: 'distributions', description: 'Distribuições de novos casos (REST V3)', edgeFunctions: ['api-distributions', 'manage-distribution-terms', 'sync-distributions'] },
        { type: 'processes', description: 'Processos judiciais e andamentos (REST V3)', edgeFunctions: ['api-processes', 'sync-process-management', 'sync-process-updates'] },
        { type: 'terms', description: 'Termos de busca (SOAP + REST V2)', edgeFunctions: ['manage-search-terms', 'sync-search-terms'] },
      ],
    },
    edgeFunctions: [
      { name: 'api-publications', path: 'api-publications', description: 'API de consulta de publicações para clientes externos (Token)', authType: 'token', actions: ['list', 'detail', 'confirm'] },
      { name: 'api-distributions', path: 'api-distributions', description: 'API de consulta de distribuições para clientes externos (Token)', authType: 'token', actions: ['list', 'detail', 'confirm'] },
      { name: 'api-processes', path: 'api-processes', description: 'API de consulta de processos para clientes externos (Token)', authType: 'token', actions: ['list', 'detail', 'confirm'] },
      { name: 'api-management', path: 'api-management', description: 'API de gerenciamento sistema-a-sistema (Token)', authType: 'token', actions: ['register-pub-term', 'delete-pub-term', 'register-dist-term', 'delete-dist-term', 'register-process', 'delete-process', 'list-services'] },
      { name: 'manage-search-terms', path: 'manage-search-terms', description: 'Gerenciamento de termos de publicação (SOAP + REST V2)', authType: 'jwt', actions: Object.values(actionMappings).filter(a => endpoints.find(e => e.edgeFunctionPath === 'manage-search-terms' && e.actionMapping === a)) },
      { name: 'manage-distribution-terms', path: 'manage-distribution-terms', description: 'Gerenciamento de termos de distribuição (REST V3)', authType: 'jwt', actions: Object.values(actionMappings).filter(a => endpoints.find(e => e.edgeFunctionPath === 'manage-distribution-terms' && e.actionMapping === a)) },
      { name: 'sync-process-management', path: 'sync-process-management', description: 'Gerenciamento de processos + REST V3 Andamentos', authType: 'jwt', actions: Object.values(actionMappings).filter(a => endpoints.find(e => e.edgeFunctionPath === 'sync-process-management' && e.actionMapping === a)) },
      { name: 'sync-publications', path: 'sync-publications', description: 'Sincronização automática de publicações com confirmação', authType: 'jwt', actions: ['sync'] },
      { name: 'sync-distributions', path: 'sync-distributions', description: 'Sincronização automática de distribuições com confirmação', authType: 'jwt', actions: ['sync'] },
      { name: 'sync-process-updates', path: 'sync-process-updates', description: 'Sincronização automática de andamentos/documentos com confirmação', authType: 'jwt', actions: ['sync'] },
    ],
    endpoints,
    actionMappings,
  };
}

export function downloadPlaygroundExport(baseUrl: string) {
  const exportData = generatePlaygroundExport(baseUrl);
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hub-juridico-playground-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
