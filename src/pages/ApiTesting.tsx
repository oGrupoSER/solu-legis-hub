import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play, Copy, Code, FileText, Download, Gavel, FileSearch, BookOpen, CheckCircle, Shield, Key, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";

import { downloadPlaygroundExport } from "@/lib/playground-export";
import { useQuery } from "@tanstack/react-query";

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

// ─── PROCESSOS ────────────────────────────────────────────────
// Helper: determine service_type filter based on endpoint path
const getServiceTypeFilter = (path: string): string | null => {
  if (path.includes("search-terms") || path.includes("publication")) return "terms";
  if (path.includes("distribution")) return "distributions";
  if (path.includes("process")) return "processes";
  return null;
};

export const processEndpoints: EndpointDef[] = [
  // Consulta
  {
    id: "list-processes", label: "Listar Processos", method: "GET", path: "api-processes",
    category: "query", authType: "token",
    description: "Retorna lista de processos vinculados ao cliente do token. Máximo 500 por lote com confirmação obrigatória.",
    params: [
      { key: "limit", label: "Limite", placeholder: "500" },
      { key: "offset", label: "Offset", placeholder: "0" },
      { key: "numero", label: "Número do Processo", placeholder: "0000000-00.0000.0.00.0000" },
      { key: "tribunal", label: "Tribunal", placeholder: "TJSP" },
      { key: "instancia", label: "Instância", placeholder: "1" },
      { key: "status", label: "Status", placeholder: "active" },
      { key: "uf", label: "UF", placeholder: "SP" },
    ],
  },
  {
    id: "detail-process", label: "Detalhe do Processo", method: "GET", path: "api-processes",
    category: "query", authType: "token",
    description: "Retorna detalhes completos de um processo. Use include para sub-recursos.",
    params: [
      { key: "id", label: "ID do Processo (UUID)", placeholder: "uuid" },
      { key: "include", label: "Incluir (separado por vírgula)", placeholder: "movements,documents,parties,cover,groupers" },
    ],
  },
  {
    id: "confirm-processes", label: "Confirmar Lote", method: "POST", path: "api-processes?action=confirm",
    category: "query", authType: "token",
    description: "Confirma recebimento do último lote de processos para liberar novos registros.",
    params: [],
  },
  // Gerenciamento
  {
    id: "register-process", label: "Cadastrar Processo", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Cadastra um novo processo CNJ para monitoramento na Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "processNumber", label: "Número do Processo (CNJ)", placeholder: "0000000-00.0000.0.00.0000", required: true },
      { key: "instance", label: "Instância", placeholder: "1, 2, 3 ou 0 (todas)", required: true },
      { key: "uf", label: "UF", placeholder: "SP" },
      { key: "codTribunal", label: "Código do Tribunal", placeholder: "8", type: "number" },
      { key: "comarca", label: "Comarca", placeholder: "São Paulo" },
      { key: "autor", label: "Autor", placeholder: "Nome do autor" },
      { key: "reu", label: "Réu", placeholder: "Nome do réu" },
      { key: "clientSystemId", label: "ID do Sistema Cliente", placeholder: "uuid (opcional)" },
    ],
  },
  {
    id: "delete-process", label: "Excluir Processo", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Remove um processo do monitoramento na Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "processNumber", label: "Número do Processo (CNJ)", placeholder: "0000000-00.0000.0.00.0000", required: true },
      { key: "clientSystemId", label: "ID do Sistema Cliente", placeholder: "uuid (opcional)" },
    ],
  },
  {
    id: "status-process", label: "Status do Processo", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Consulta o status de cadastro de um processo na Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "processNumber", label: "Número do Processo (CNJ)", placeholder: "0000000-00.0000.0.00.0000", required: true },
    ],
  },
  {
    id: "list-registered-processes", label: "Listar Processos Cadastrados", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Lista todos os processos cadastrados em um serviço na Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    ],
  },
  {
    id: "resend-pending-processes", label: "Reenviar Pendentes", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Reenvia processos com status pendente ou erro para a Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    ],
  },
  {
    id: "sync-processes", label: "Sincronizar Processos", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Sincroniza status de todos os processos cadastrados + busca novos via BuscaProcessos.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    ],
  },
  // ─── REST V3 Andamentos ─────────────────────────────────────
  {
    id: "and-cadastrar-processo", label: "Cadastrar Processo", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Cadastra um novo processo diretamente na API V3 (CadastraNovoProcesso).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
      { key: "numProcesso", label: "Número do Processo (CNJ)", placeholder: "0000000-00.0000.0.00.0000", required: true },
      { key: "Instancia", label: "Instância", placeholder: "3", required: true, type: "number" },
    ],
  },
  {
    id: "and-excluir-processo", label: "Excluir Processo", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Exclui um processo via API V3 (ExcluirProcesso).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codProcesso", label: "Código do Processo", placeholder: "105980409", required: true, type: "number" },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-status", label: "Buscar Status do Processo", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca o status de um processo na API V3 (BuscaStatusProcesso).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codProcesso", label: "Código do Processo", placeholder: "104795496", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-processos", label: "Buscar Processos", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca processos por escritório na API V3 (BuscaProcessos).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-novos-agrupadores", label: "Buscar Novos Agrupadores", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca novos agrupadores na API V3 (BuscaNovosAgrupadores).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-agrupadores-escritorio", label: "Buscar Agrupadores Por Escritório", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca agrupadores por escritório na API V3 (BuscaAgrupadoresPorEscritorio).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-confirmar-agrupador", label: "Confirmar Recebimento Agrupador", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Confirma recebimento de agrupador na API V3 (ConfirmaRecebimentoAgrupador).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
      { key: "codAgrupador", label: "Código do Agrupador", placeholder: "64010523", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-novas-dependencias", label: "Buscar Novas Dependências", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca novas dependências na API V3 (BuscaNovasDependencias).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-dependencias-escritorio", label: "Buscar Dependências Por Escritório", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca dependências por escritório na API V3 (BuscaDependenciasPorEscritorio).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codProcesso", label: "Código do Processo", placeholder: "105980409", required: true, type: "number" },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-confirmar-dependencia", label: "Confirmar Recebimento Dependências", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Confirma recebimento de dependência na API V3 (ConfirmaRecebimentoDependencia).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
      { key: "codDependencia", label: "Código da Dependência", placeholder: "24870613", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-novos-andamentos", label: "Buscar Novos Andamentos", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca novos andamentos na API V3 (BuscaNovosAndamentos).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-andamentos-escritorio", label: "Buscar Andamentos Por Escritório", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca andamentos por escritório na API V3 (BuscaNovosAndamentosPorEscritorio).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-confirmar-andamento", label: "Confirmar Recebimento de Andamentos", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Confirma recebimento de andamento na API V3 (ConfirmaRecebimentoAndamento).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
      { key: "codAndamento", label: "Código do Andamento", placeholder: "123", required: true, type: "number" },
      { key: "codProcesso", label: "Código do Processo", placeholder: "123", required: true, type: "number" },
      { key: "codAgrupador", label: "Código do Agrupador", placeholder: "123", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-capa", label: "Busca Capa por Processo", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca dados de capa de um processo na API V3 (BuscaDadosCapaProcessoPorProcesso).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codProcesso", label: "Código do Processo", placeholder: "104795496", required: true, type: "number" },
    ],
  },
  {
    id: "and-buscar-novos-documentos", label: "Buscar Novos Documentos", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca novos documentos na API V3 (BuscaNovosDocumentos).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    ],
  },
  {
    id: "and-buscar-documentos-escritorio", label: "Buscar Documentos Escritório", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca documentos por escritório na API V3 (BuscaNovosDocumentos com codEscritorio).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-confirmar-documento", label: "Confirmar Recebimento Documento", method: "POST", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Confirma recebimento de documento na API V3 (ConfirmaRecebimentoDocumento).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
      { key: "codDocumento", label: "Código do Documento", placeholder: "2", required: true, type: "number" },
    ],
  },
  {
    id: "and-todos-andamentos-processo", label: "Todos Andamentos por Processo", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca todos os andamentos de um processo na API V3 (BuscaTodosAndamentosPorProcesso).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codProcesso", label: "Código do Processo", placeholder: "104795496", required: true, type: "number" },
    ],
  },
  {
    id: "and-todos-agrupadores-processo", label: "Todos Agrupadores por Processo", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca todos os agrupadores de um processo na API V3 (BuscaTodosAgrupadoresPorProcesso).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codProcesso", label: "Código do Processo", placeholder: "104795496", required: true, type: "number" },
    ],
  },
  {
    id: "and-todos-documentos-processo", label: "Todos Documentos por Processo", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca todos os documentos de um processo na API V3 (BuscaTodosDocumentosPorProcesso).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codProcesso", label: "Código do Processo", placeholder: "104795496", required: true, type: "number" },
    ],
  },
  {
    id: "and-processos-cadastrados", label: "Processos Cadastrados", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Lista processos cadastrados por escritório na API V3 (BuscaProcessosCadastrados).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "and-qtd-andamentos", label: "QTD Andamentos Disponíveis", method: "GET", path: "sync-process-management",
    category: "management", authType: "jwt",
    description: "Busca quantidade de andamentos disponíveis na API V3 (BuscaQuantidadeAndamentosDisponiveis).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
];

// ─── DISTRIBUIÇÕES ────────────────────────────────────────────
export const distributionEndpoints: EndpointDef[] = [
  // Consulta
  {
    id: "list-distributions", label: "Listar Distribuições", method: "GET", path: "api-distributions",
    category: "query", authType: "token",
    description: "Retorna distribuições vinculadas aos termos de busca do cliente. Máximo 500 por lote.",
    params: [
      { key: "limit", label: "Limite", placeholder: "500" },
      { key: "offset", label: "Offset", placeholder: "0" },
      { key: "termo", label: "Termo", placeholder: "nome da parte" },
      { key: "tribunal", label: "Tribunal", placeholder: "TJSP" },
      { key: "data_inicial", label: "Data Inicial", placeholder: "2026-01-01", type: "date" },
      { key: "data_final", label: "Data Final", placeholder: "2026-12-31", type: "date" },
    ],
  },
  {
    id: "detail-distribution", label: "Detalhe da Distribuição", method: "GET", path: "api-distributions",
    category: "query", authType: "token",
    description: "Retorna detalhes de uma distribuição específica.",
    params: [{ key: "id", label: "ID da Distribuição (UUID)", placeholder: "uuid" }],
  },
  {
    id: "confirm-distributions", label: "Confirmar Lote", method: "POST", path: "api-distributions?action=confirm",
    category: "query", authType: "token",
    description: "Confirma recebimento do último lote de distribuições.",
    params: [],
  },
  // Gerenciamento REST V3
  {
    id: "dis-autenticar", label: "Autenticação", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Autentica na API REST V3 de Distribuições e retorna o tokenJWT.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service (tipo distributions)", required: true },
    ],
  },
  {
    id: "dis-cadastrar-escritorio", label: "Cadastrar Escritório", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Cadastra um novo escritório para monitoramento de distribuições (CadastrarEscritorio).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
      { key: "utilizaDocumentosIniciais", label: "Utiliza Documentos Iniciais", placeholder: "1", type: "number" },
    ],
  },
  {
    id: "dis-ativar-escritorio", label: "Ativar Escritório", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Ativa um escritório de distribuição na Solucionare (AtivarEscritorio).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "dis-cadastrar-termo", label: "Cadastrar Termo", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Cadastra um novo nome/termo para monitoramento de distribuições (CadastrarNome).\nInstância fixa: Todas (4). Abrangências preenchidas automaticamente.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "nome", label: "Nome", placeholder: "VPM ESTACIONAMENTOS LTDA  11482194000125", required: true },
      { key: "codTipoConsulta", label: "Código Tipo Consulta", placeholder: "1", type: "number" },
      { key: "qtdDiasCapturaRetroativa", label: "Dias Captura Retroativa", placeholder: "90", type: "number" },
    ],
  },
  {
    id: "dis-desativar-termo", label: "Desativar Termo", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Desativa um nome/termo de distribuição na Solucionare (DesativarNome).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codNome", label: "Código do Nome (Solucionare)", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "dis-buscar-distribuicoes", label: "Buscar Distribuições", method: "GET", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Busca novas distribuições diretamente da API Solucionare (BuscaNovasDistribuicoes).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", type: "number" },
    ],
  },
  {
    id: "dis-buscar-nomes", label: "Buscar Nomes Cadastrados", method: "GET", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Lista todos os nomes cadastrados na Solucionare (BuscaNomesCadastrados).",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    ],
  },
  {
    id: "dis-confirmar-recebimento", label: "Confirmar Recebimento", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Confirma recebimento de distribuições na API V3 (ConfirmaRecebimentoDistribuicoes). Envie um array JSON de objetos com codEscritorio e codProcesso.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
      { key: "distribuicoes", label: "Distribuições (JSON array)", placeholder: '[{"codEscritorio": 41, "codProcesso": 195148028}]', required: true },
    ],
  },
];

// ─── PUBLICAÇÕES ──────────────────────────────────────────────
export const publicationEndpoints: EndpointDef[] = [
  // Consulta
  {
    id: "list-publications", label: "Listar Publicações", method: "GET", path: "api-publications",
    category: "query", authType: "token",
    description: "Retorna publicações de diários oficiais vinculadas aos termos do cliente. Máximo 500 por lote.",
    params: [
      { key: "limit", label: "Limite", placeholder: "500" },
      { key: "offset", label: "Offset", placeholder: "0" },
      { key: "termo", label: "Termo", placeholder: "nome da parte" },
      { key: "diario", label: "Diário", placeholder: "DJE" },
      { key: "data_inicial", label: "Data Inicial", placeholder: "2026-01-01", type: "date" },
      { key: "data_final", label: "Data Final", placeholder: "2026-12-31", type: "date" },
    ],
  },
  {
    id: "detail-publication", label: "Detalhe da Publicação", method: "GET", path: "api-publications",
    category: "query", authType: "token",
    description: "Retorna detalhes de uma publicação específica.",
    params: [{ key: "id", label: "ID da Publicação (UUID)", placeholder: "uuid" }],
  },
  {
    id: "confirm-publications", label: "Confirmar Lote", method: "POST", path: "api-publications?action=confirm",
    category: "query", authType: "token",
    description: "Confirma recebimento do último lote de publicações.",
    params: [],
  },
  // Gerenciamento REST V2
  {
    id: "rest-autenticar", label: "Autenticação", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Autentica na API REST V2 da Solucionare e retorna um tokenJWT.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service (tipo terms)", required: true },
    ],
  },
  {
    id: "rest-cadastrar-nome", label: "Cadastrar Nome", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Cadastra um novo nome (termo) para monitoramento de publicações. Retorna o codNome gerado.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.nome", label: "Nome", placeholder: "CHRISTIAN FERNANDES DE BARROS", required: true },
      { key: "data.codEscritorio", label: "Código do Escritório", placeholder: "41", type: "number" },
    ],
  },
  {
    id: "rest-excluir-nome", label: "Excluir Nome", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Exclui um nome (termo) pelo codNome gerado no cadastro.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.codNome", label: "Código do Nome", placeholder: "636295", required: true, type: "number" },
    ],
  },
  {
    id: "rest-consultar-nomes", label: "Consultar Nomes", method: "GET", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Consulta nomes cadastrados por código de escritório. Use codUltimoNome para paginação.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
      { key: "data.codUltimoNome", label: "Código Último Nome", placeholder: "1", type: "number" },
    ],
  },
  {
    id: "rest-cadastrar-oab", label: "Cadastrar OAB", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Cadastra uma OAB vinculada a um codNome. Número com 6 dígitos, letra 's' fixo.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.codNome", label: "Código do Nome", placeholder: "637666", required: true, type: "number" },
      { key: "data.uf", label: "UF da OAB", placeholder: "RS", required: true },
      { key: "data.numero", label: "Número da OAB", placeholder: "000000", required: true },
      { key: "data.letra", label: "Letra", placeholder: "s" },
    ],
  },
  {
    id: "rest-consultar-oab", label: "Consultar OAB", method: "GET", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Consulta OABs vinculadas a um codNome. Use codUltimoOab para paginação.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.codNome", label: "Código do Nome", placeholder: "636295", required: true, type: "number" },
      { key: "data.codUltimoOab", label: "Código Última OAB", placeholder: "1233", type: "number" },
    ],
  },
  {
    id: "rest-cadastrar-variacao", label: "Cadastrar Variação", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Cadastra variações de um nome para ampliar o monitoramento.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.codNome", label: "Código do Nome", placeholder: "637668", required: true, type: "number" },
      { key: "data.listVariacoes", label: "Lista de Variações (JSON array)", placeholder: '["ADMINISTRADORA GERAL DE ESTACIONAMENTOS S A"]', required: true },
      { key: "data.variacaoTipoNumProcesso", label: "Variação Tipo Num Processo", placeholder: "true" },
    ],
  },
  {
    id: "rest-cadastrar-termo-validacao", label: "Cadastrar TermoValidação", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Cadastra termos de validação para nomes e variações.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.listTermosValidacaoNome", label: "Termos Validação Nome (JSON)", placeholder: '[{"codNome": 637668, "termoValidacao": "TERMO"}]', required: true },
      { key: "data.listTermosValidacaoVariacao", label: "Termos Validação Variação (JSON)", placeholder: '[{"codVariacao": 637669, "termoValidacao": "TERMO"}]' },
    ],
  },
  {
    id: "rest-cadastrar-abrangencia", label: "Cadastrar Abrangência", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Cadastra abrangências (diários) para um nome. Use os códigos do catálogo.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.codNome", label: "Código do Nome", placeholder: "637719", required: true, type: "number" },
      { key: "data.listCodDiarios", label: "Lista Códigos Diários (JSON array)", placeholder: "[434, 718, 526, 717, 295]", required: true },
    ],
  },
  {
    id: "rest-buscar-catalogo", label: "Buscar Catálogo", method: "GET", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Busca o catálogo completo de diários/abrangências disponíveis na Solucionare.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    ],
  },
  {
    id: "rest-buscar-publicacoes", label: "Buscar Publicações", method: "GET", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Busca publicações diretamente da API REST V2 por código de escritório.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "data.codEscritorio", label: "Código do Escritório", placeholder: "41", required: true, type: "number" },
    ],
  },
  {
    id: "rest-confirmar-recebimento", label: "Confirmar Recebimento", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Confirma recebimento de publicações na API REST V2 (publicacao_confirmarRecebimento). Envie um array JSON de IDs de publicações.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service (tipo terms)", required: true },
      { key: "data.ids", label: "IDs das Publicações (JSON array)", placeholder: "[135040011, 479125026]", required: true },
    ],
  },
];

// ─── Action map for management endpoints ──────────────────────
export const managementActionMap: Record<string, string> = {
  // Processos
  "register-process": "register",
  "delete-process": "delete",
  "status-process": "status",
  "list-registered-processes": "list",
  "resend-pending-processes": "send-pending",
  "sync-processes": "sync",
  // Andamentos REST V3
  "and-cadastrar-processo": "rest_cadastrar_processo",
  "and-excluir-processo": "rest_excluir_processo",
  "and-buscar-status": "rest_buscar_status",
  "and-buscar-processos": "rest_buscar_processos",
  "and-buscar-novos-agrupadores": "rest_buscar_novos_agrupadores",
  "and-buscar-agrupadores-escritorio": "rest_buscar_agrupadores_escritorio",
  "and-confirmar-agrupador": "rest_confirmar_agrupador",
  "and-buscar-novas-dependencias": "rest_buscar_novas_dependencias",
  "and-buscar-dependencias-escritorio": "rest_buscar_dependencias_escritorio",
  "and-confirmar-dependencia": "rest_confirmar_dependencia",
  "and-buscar-novos-andamentos": "rest_buscar_novos_andamentos",
  "and-buscar-andamentos-escritorio": "rest_buscar_andamentos_escritorio",
  "and-confirmar-andamento": "rest_confirmar_andamento",
  "and-buscar-capa": "rest_buscar_capa",
  "and-buscar-novos-documentos": "rest_buscar_novos_documentos",
  "and-buscar-documentos-escritorio": "rest_buscar_documentos_escritorio",
  "and-confirmar-documento": "rest_confirmar_documento",
  "and-todos-andamentos-processo": "rest_todos_andamentos_processo",
  "and-todos-agrupadores-processo": "rest_todos_agrupadores_processo",
  "and-todos-documentos-processo": "rest_todos_documentos_processo",
  "and-processos-cadastrados": "rest_processos_cadastrados",
  "and-qtd-andamentos": "rest_qtd_andamentos",
  // Distribuições REST V3
  "dis-autenticar": "rest_autenticar",
  "dis-cadastrar-escritorio": "registerOffice",
  "dis-ativar-escritorio": "activateOffice",
  "dis-cadastrar-termo": "registerName",
  "dis-desativar-termo": "deactivateName",
  "dis-buscar-distribuicoes": "rest_buscar_distribuicoes",
  "dis-buscar-nomes": "listNames",
  // Publicações REST V2 (manage-search-terms)
  "rest-autenticar": "rest_autenticar",
  "rest-cadastrar-nome": "rest_cadastrar_nome",
  "rest-excluir-nome": "rest_excluir_nome",
  "rest-consultar-nomes": "rest_consultar_nomes",
  "rest-cadastrar-oab": "rest_cadastrar_oab",
  "rest-consultar-oab": "rest_consultar_oab",
  "rest-cadastrar-variacao": "rest_cadastrar_variacao",
  "rest-cadastrar-termo-validacao": "rest_cadastrar_termo_validacao",
  "rest-cadastrar-abrangencia": "rest_cadastrar_abrangencia",
  "rest-buscar-catalogo": "rest_buscar_catalogo",
  "rest-buscar-publicacoes": "rest_buscar_publicacoes",
  "rest-confirmar-recebimento": "rest_confirmar_recebimento",
  "dis-confirmar-recebimento": "confirmDistributions",
};

const ApiTesting = () => {
  const [serviceTab, setServiceTab] = useState("publications");
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef | null>(null);
  const [token, setToken] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyValues, setBodyValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(0);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const { data: tokens } = useQuery({
    queryKey: ["api-tokens-playground"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_tokens").select("id, name, token, is_active, is_blocked, client_systems(name)").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });
  const { data: partnerServices } = useQuery({
    queryKey: ["partner-services-playground"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_services")
        .select("id, service_name, service_type, is_active, partners(name)")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const getFilteredServices = () => {
    if (!partnerServices || !selectedEndpoint) return [];
    const filterType = getServiceTypeFilter(selectedEndpoint!.path);
    if (!filterType) return partnerServices;
    return partnerServices.filter((s) => s.service_type === filterType);
  };

  const getEndpointsForTab = () => {
    if (serviceTab === "processes") return processEndpoints;
    if (serviceTab === "distributions") return distributionEndpoints;
    return publicationEndpoints;
  };

  const selectEndpoint = (ep: EndpointDef) => {
    setSelectedEndpoint(ep);
    setParamValues({});
    setBodyValues({});
    setResponse(null);
  };

  const buildUrl = () => {
    if (!selectedEndpoint) return baseUrl;
    let url = `${baseUrl}/${selectedEndpoint.path}`;
    const queryParts: string[] = [];
    for (const p of selectedEndpoint.params) {
      const val = paramValues[p.key];
      if (val) queryParts.push(`${p.key}=${encodeURIComponent(val)}`);
    }
    if (queryParts.length > 0) {
      url += (url.includes("?") ? "&" : "?") + queryParts.join("&");
    }
    return url;
  };

  const buildBody = (): Record<string, any> | null => {
    if (!selectedEndpoint) return null;
    if (!selectedEndpoint.bodyParams?.length && !managementActionMap[selectedEndpoint.id]) return null;
    
    const action = managementActionMap[selectedEndpoint.id];
    
    // manage-search-terms uses { action, service_id, data: { ... } }
    const isSearchTerms = selectedEndpoint.path === "manage-search-terms";
    
    const body: Record<string, any> = {};
    if (action) body.action = action;

    if (isSearchTerms) {
      const data: Record<string, any> = {};
      for (const p of (selectedEndpoint.bodyParams || [])) {
        const val = bodyValues[p.key];
        if (!val && !p.required) continue;
        if (p.key.startsWith("data.")) {
          const actualKey = p.key.slice(5);
          if (p.type === "number") {
            data[actualKey] = val ? Number(val) : undefined;
          } else if (val && (val.startsWith("[") || val.startsWith("{"))) {
            try { data[actualKey] = JSON.parse(val); } catch { data[actualKey] = val; }
          } else {
            data[actualKey] = val || undefined;
          }
        } else {
          if (p.type === "number") {
            body[p.key] = val ? Number(val) : undefined;
          } else if (val && (val.startsWith("[") || val.startsWith("{"))) {
            try { body[p.key] = JSON.parse(val); } catch { body[p.key] = val; }
          } else {
            body[p.key] = val || undefined;
          }
        }
      }
      if (Object.keys(data).length > 0) body.data = data;
    } else {
      for (const p of (selectedEndpoint.bodyParams || [])) {
        const val = bodyValues[p.key];
        if (!val && !p.required) continue;
        if (p.type === "number") {
          body[p.key] = val ? Number(val) : undefined;
        } else if (val && (val.startsWith("[") || val.startsWith("{"))) {
          try { body[p.key] = JSON.parse(val); } catch { body[p.key] = val; }
        } else {
          body[p.key] = val || undefined;
        }
      }
    }
    return body;
  };

  const handleTest = async () => {
    if (!selectedEndpoint) return;
    const isManagement = selectedEndpoint.authType === "jwt";

    if (!isManagement && !token) {
      toast.error("Selecione ou insira um token");
      return;
    }

    // Validate required body params
    if (selectedEndpoint.bodyParams) {
      const missing = selectedEndpoint.bodyParams.filter(p => p.required && !bodyValues[p.key]);
      if (missing.length > 0) {
        toast.error(`Campos obrigatórios: ${missing.map(p => p.label).join(", ")}`);
        return;
      }
    }

    // Validate abrangências limit for distribution endpoints
    if (selectedEndpoint.path === "manage-distribution-terms" && bodyValues["abrangencias"]) {
      try {
        const abr = JSON.parse(bodyValues["abrangencias"]);
        if (Array.isArray(abr) && abr.length > 100) {
          toast.error(`A lista de abrangências contém ${abr.length} itens, mas o limite da API do parceiro é de ~100. Reduza a seleção antes de enviar.`);
          return;
        }
      } catch { /* will be caught later as invalid JSON */ }
    }

    setIsLoading(true);
    const startTime = Date.now();
    try {
      const url = buildUrl();
      const body = buildBody();

      let authHeader: string;
      if (isManagement) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error("Faça login para usar endpoints de gerenciamento");
          setIsLoading(false);
          return;
        }
        authHeader = `Bearer ${session.access_token}`;
      } else {
        authHeader = `Bearer ${token}`;
      }

      const fetchOptions: RequestInit = {
        method: body ? "POST" : selectedEndpoint.method,
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      };
      if (body) fetchOptions.body = JSON.stringify(body);

      const res = await fetch(url, fetchOptions);
      const data = await res.json();
      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: {
          "X-RateLimit-Limit": res.headers.get("X-RateLimit-Limit"),
          "X-RateLimit-Remaining": res.headers.get("X-RateLimit-Remaining"),
          "X-RateLimit-Reset": res.headers.get("X-RateLimit-Reset"),
        },
        data,
      });
      setResponseTime(Date.now() - startTime);
      if (res.ok) {
        toast.success("Requisição executada");
      } else {
        const errMsg = data?.error || data?.message || `Status ${res.status}`;
        if (typeof errMsg === "string" && (errMsg.includes("excede o limite") || errMsg.includes("abrangências") || errMsg.includes("truncated"))) {
          toast.error(`Limite da API do parceiro: a lista de abrangências excede o máximo permitido (~100). Reduza a seleção e tente novamente.`);
        } else {
          toast.error(`Erro: ${errMsg}`);
        }
      }
    } catch (error: any) {
      setResponse({ status: 0, statusText: "Network Error", data: { error: error.message } });
      toast.error("Erro de rede");
    } finally {
      setIsLoading(false);
    }
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  // Build code examples including body if present
  const queryString = selectedEndpoint?.params
    ?.filter(p => paramValues[p.key])
    .map(p => `${p.key}=${encodeURIComponent(paramValues[p.key])}`)
    .join("&") || "";
  const fullPath = selectedEndpoint ? `${selectedEndpoint.path}${queryString ? (selectedEndpoint.path.includes("?") ? "&" : "?") + queryString : ""}` : "";
  const exampleBody = buildBody();
  const bodyJsonStr = exampleBody ? JSON.stringify(exampleBody, null, 2) : null;
  const isJwt = selectedEndpoint?.authType === "jwt";
  const tokenLabel = isJwt ? "SEU_JWT_TOKEN" : (token || "SEU_TOKEN");
  const epMethod = selectedEndpoint?.method || "GET";

  const codeExamples = {
    curl: `curl -X ${exampleBody ? "POST" : epMethod} "${baseUrl}/${fullPath}" \\\n  -H "Authorization: Bearer ${tokenLabel}" \\\n  -H "Content-Type: application/json"${bodyJsonStr ? ` \\\n  -d '${bodyJsonStr}'` : ""}`,
    javascript: `const response = await fetch('${baseUrl}/${fullPath}', {\n  method: '${exampleBody ? "POST" : epMethod}',\n  headers: {\n    'Authorization': 'Bearer ${tokenLabel}',\n    'Content-Type': 'application/json'\n  }${bodyJsonStr ? `,\n  body: JSON.stringify(${bodyJsonStr})` : ""}\n});\nconst data = await response.json();\nconsole.log(data);`,
    python: `import requests\n\nresponse = requests.${(exampleBody ? "post" : epMethod.toLowerCase())}(\n    '${baseUrl}/${fullPath}',\n    headers={\n        'Authorization': 'Bearer ${tokenLabel}',\n        'Content-Type': 'application/json'\n    }${bodyJsonStr ? `,\n    json=${bodyJsonStr}` : ""}\n)\nprint(response.json())`,
  };

  const tabIcons: Record<string, React.ReactNode> = {
    processes: <Gavel className="h-4 w-4" />,
    distributions: <FileSearch className="h-4 w-4" />,
    publications: <BookOpen className="h-4 w-4" />,
  };

  const renderEndpointList = (endpoints: EndpointDef[]) => {
    const mgmtEps = endpoints.filter(ep => ep.category === "management");

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1 pt-1">
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gerenciamento</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">JWT</Badge>
        </div>
        {mgmtEps.map((ep) => (
          <button
            key={ep.id}
            onClick={() => selectEndpoint(ep)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedEndpoint?.id === ep.id ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}
          >
            <div className="flex items-center gap-2">
              <Badge 
                variant={ep.method === "GET" ? "secondary" : "default"} 
                className={`text-xs font-mono ${ep.method === "GET" ? "bg-blue-100 text-blue-700" : "bg-amber-600"}`}
              >
                {ep.method}
              </Badge>
              <span className="font-medium text-sm">{ep.label}</span>
              <Shield className="h-3.5 w-3.5 text-amber-500 ml-auto" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{ep.description}</p>
          </button>
        ))}
      </div>
    );
  };

  const allTabs = ["publications", "distributions", "processes"];

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Playground de API" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Playground de API</h1>
          <p className="text-muted-foreground mt-1">Teste endpoints, visualize respostas e exporte para Postman</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={async () => { await downloadPlaygroundExport(import.meta.env.VITE_SUPABASE_URL); toast.success("Playground exportado para Postman!"); }}>
            <Download className="h-4 w-4" />Exportar Playground
          </Button>
        </div>
      </div>

      {/* Service tabs */}
      <Tabs value={serviceTab} onValueChange={(v) => {
        setServiceTab(v);
        setSelectedEndpoint(null);
        setResponse(null);
      }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="publications" className="gap-2">{tabIcons.publications} Publicações</TabsTrigger>
          <TabsTrigger value="distributions" className="gap-2">{tabIcons.distributions} Distribuições</TabsTrigger>
          <TabsTrigger value="processes" className="gap-2">{tabIcons.processes} Processos</TabsTrigger>
        </TabsList>

        {allTabs.map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="grid gap-6" style={{ gridTemplateColumns: "350px 1fr" }}>
              {/* Left: Endpoint list (sticky) */}
              <div className="sticky top-4 self-start">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Endpoints
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[calc(100vh-220px)] overflow-y-auto">
                    {renderEndpointList(getEndpointsForTab())}
                  </CardContent>
                </Card>
              </div>

              {/* Right: Params + Execute + Response + Code */}
              <div className="space-y-4">
                {!selectedEndpoint ? (
                  <Card>
                    <CardContent className="py-16">
                      <div className="text-center text-muted-foreground">
                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">Selecione um endpoint</p>
                        <p className="text-sm mt-1">Escolha um endpoint na lista à esquerda para começar</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Token selector for non-JWT endpoints */}
                    {selectedEndpoint.authType !== "jwt" && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Autenticação</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            <Select onValueChange={(v) => setToken(v)}>
                              <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um token..." /></SelectTrigger>
                              <SelectContent>
                                {tokens?.map((t: any) => (
                                  <SelectItem key={t.id} value={t.token}>
                                    <div className="flex items-center gap-2">
                                      {t.name} <span className="text-muted-foreground text-xs">({t.client_systems?.name || "sem cliente"})</span>
                                      {t.is_blocked && <Badge variant="destructive" className="text-xs">Bloqueado</Badge>}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Ou cole um token..." className="flex-1" type="password" />
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedEndpoint.authType === "jwt" && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <Shield className="h-4 w-4 shrink-0" />
                        Este endpoint usa autenticação JWT do usuário logado (automático)
                      </div>
                    )}

                    {/* Query Parameters */}
                    {selectedEndpoint.params.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Parâmetros de Query</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedEndpoint.params.map((p) => (
                            <div key={p.key} className="space-y-1">
                              <Label className="text-xs">
                                {p.label} <span className="text-muted-foreground">({p.key})</span>
                                {p.required && <span className="text-destructive ml-1">*</span>}
                              </Label>
                              <Input
                                type={p.type || "text"}
                                value={paramValues[p.key] || ""}
                                onChange={(e) => setParamValues({ ...paramValues, [p.key]: e.target.value })}
                                placeholder={p.placeholder}
                              />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Body Parameters */}
                    {selectedEndpoint.bodyParams && selectedEndpoint.bodyParams.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            Body JSON
                            <Badge variant="outline" className="text-xs font-normal">POST</Badge>
                          </CardTitle>
                          <CardDescription>Preencha os campos do body da requisição</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedEndpoint.bodyParams.map((p) => (
                            <div key={p.key} className="space-y-1">
                              <Label className="text-xs">
                                {p.label} <span className="text-muted-foreground">({p.key.replace("data.", "")})</span>
                                {p.required && <span className="text-destructive ml-1">*</span>}
                              </Label>
                              {(p.key === "serviceId" || p.key === "service_id") ? (
                                <Select
                                  value={bodyValues[p.key] || ""}
                                  onValueChange={(val) => setBodyValues({ ...bodyValues, [p.key]: val })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione um serviço" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getFilteredServices().map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {(s.partners as any)?.name || "Parceiro"} — {s.service_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type={p.type || "text"}
                                  value={bodyValues[p.key] || ""}
                                  onChange={(e) => setBodyValues({ ...bodyValues, [p.key]: e.target.value })}
                                  placeholder={p.placeholder}
                                />
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    <Button onClick={handleTest} disabled={isLoading} className="w-full gap-2">
                      <Play className="h-4 w-4" />{isLoading ? "Executando..." : "Executar Requisição"}
                    </Button>

                    {/* Response */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Resposta</CardTitle>
                          {response && (
                            <div className="flex items-center gap-2">
                              <Badge variant={response.status >= 200 && response.status < 300 ? "default" : "destructive"}>{response.status} {response.statusText}</Badge>
                              <Badge variant="outline">{responseTime}ms</Badge>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {!response ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Execute uma requisição para ver a resposta</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {response.headers?.["X-RateLimit-Limit"] && (
                              <div className="flex gap-2 text-xs">
                                <Badge variant="outline">Limit: {response.headers["X-RateLimit-Limit"]}</Badge>
                                <Badge variant="outline">Remaining: {response.headers["X-RateLimit-Remaining"]}</Badge>
                              </div>
                            )}
                            {response.data?.batch?.pending_confirmation && (
                              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm">
                                <strong>⚠️ Lote pendente de confirmação.</strong> Confirme o recebimento antes de solicitar novos dados.
                              </div>
                            )}
                            <div className="relative">
                              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-[600px]">
                                <code>{JSON.stringify(response.data, null, 2)}</code>
                              </pre>
                              <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => copy(JSON.stringify(response.data, null, 2))}><Copy className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Code examples */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg"><Code className="h-4 w-4" />Exemplos de Código</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Tabs defaultValue="curl">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="curl">cURL</TabsTrigger>
                            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                            <TabsTrigger value="python">Python</TabsTrigger>
                          </TabsList>
                          {(["curl", "javascript", "python"] as const).map((lang) => (
                            <TabsContent key={lang} value={lang}>
                              <div className="relative">
                                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto"><code>{codeExamples[lang]}</code></pre>
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => copy(codeExamples[lang])}><Copy className="h-4 w-4" /></Button>
                              </div>
                            </TabsContent>
                          ))}
                        </Tabs>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ApiTesting;
