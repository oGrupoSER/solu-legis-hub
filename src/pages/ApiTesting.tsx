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
import { downloadPostmanCollection } from "@/lib/postman-collection";
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
const processEndpoints: EndpointDef[] = [
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
];

// ─── DISTRIBUIÇÕES ────────────────────────────────────────────
const distributionEndpoints: EndpointDef[] = [
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
  // Gerenciamento
  {
    id: "register-dist-term", label: "Cadastrar Nome", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Cadastra um novo nome/termo para monitoramento de distribuições na Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "nome", label: "Nome", placeholder: "Nome da parte a monitorar", required: true },
      { key: "codTipoConsulta", label: "Código Tipo Consulta", placeholder: "1" },
      { key: "listInstancias", label: "Instâncias (JSON array)", placeholder: "[1, 2]" },
      { key: "abrangencias", label: "Abrangências (JSON array)", placeholder: '[{"codEstado": 26}]' },
      { key: "qtdDiasCapturaRetroativa", label: "Dias Captura Retroativa", placeholder: "30", type: "number" },
      { key: "listDocumentos", label: "Documentos (JSON array)", placeholder: '["12345678900"]' },
      { key: "listOab", label: "OABs (JSON array)", placeholder: '[{"numero": "12345", "uf": "SP"}]' },
      { key: "client_system_id", label: "ID do Sistema Cliente", placeholder: "uuid (opcional)" },
    ],
  },
  {
    id: "edit-dist-term", label: "Editar Nome", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Edita um nome/termo existente para monitoramento de distribuições.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "termId", label: "ID do Termo", placeholder: "uuid do search_term", required: true },
      { key: "nome", label: "Nome", placeholder: "Novo nome" },
      { key: "codNome", label: "Código do Nome (Solucionare)", placeholder: "12345" },
      { key: "codTipoConsulta", label: "Código Tipo Consulta", placeholder: "1" },
      { key: "listInstancias", label: "Instâncias (JSON array)", placeholder: "[1, 2]" },
      { key: "abrangencias", label: "Abrangências (JSON array)", placeholder: '[{"codEstado": 26}]' },
      { key: "qtdDiasCapturaRetroativa", label: "Dias Captura Retroativa", placeholder: "30", type: "number" },
      { key: "listDocumentos", label: "Documentos (JSON array)", placeholder: '["12345678900"]' },
      { key: "listOab", label: "OABs (JSON array)", placeholder: '[{"numero": "12345", "uf": "SP"}]' },
    ],
  },
  {
    id: "activate-dist-term", label: "Ativar Nome", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Ativa um nome/termo de distribuição na Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codNome", label: "Código do Nome (Solucionare)", placeholder: "12345", required: true },
    ],
  },
  {
    id: "deactivate-dist-term", label: "Desativar Nome", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Desativa um nome/termo de distribuição na Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codNome", label: "Código do Nome (Solucionare)", placeholder: "12345", required: true },
    ],
  },
  {
    id: "delete-dist-term", label: "Excluir Nome", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Exclui um nome/termo de distribuição na Solucionare.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "codNome", label: "Código do Nome (Solucionare)", placeholder: "12345", required: true },
      { key: "client_system_id", label: "ID do Sistema Cliente", placeholder: "uuid (opcional)" },
    ],
  },
  {
    id: "list-dist-terms", label: "Listar Nomes", method: "POST", path: "manage-distribution-terms",
    category: "management", authType: "jwt",
    description: "Lista todos os nomes/termos cadastrados para distribuições em um serviço.",
    params: [],
    bodyParams: [
      { key: "serviceId", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
    ],
  },
];

// ─── PUBLICAÇÕES ──────────────────────────────────────────────
const publicationEndpoints: EndpointDef[] = [
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
  // Gerenciamento
  {
    id: "register-pub-term", label: "Cadastrar Termo", method: "POST", path: "manage-publication-terms",
    category: "management", authType: "jwt",
    description: "Cadastra um novo termo para monitoramento de publicações em diários oficiais.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "term", label: "Termo", placeholder: "Nome ou expressão a monitorar", required: true },
      { key: "term_type", label: "Tipo do Termo", placeholder: "name ou office", required: true },
      { key: "variacoes", label: "Variações (JSON array)", placeholder: '["João Silva", "J. Silva"]' },
      { key: "termos_bloqueio", label: "Termos de Bloqueio (JSON array)", placeholder: '["homônimo"]' },
      { key: "abrangencias", label: "Abrangências (JSON array)", placeholder: '[{"codEstado": 26}]' },
      { key: "oab", label: "OAB (JSON array)", placeholder: '[{"numero": "12345", "uf": "SP"}]' },
      { key: "client_system_id", label: "ID do Sistema Cliente", placeholder: "uuid (opcional)" },
    ],
  },
  {
    id: "edit-pub-term", label: "Editar Termo", method: "POST", path: "manage-publication-terms",
    category: "management", authType: "jwt",
    description: "Edita um termo existente de monitoramento de publicações.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "term_id", label: "ID do Termo", placeholder: "uuid do search_term", required: true },
      { key: "term", label: "Termo", placeholder: "Novo valor do termo", required: true },
      { key: "term_type", label: "Tipo do Termo", placeholder: "name ou office", required: true },
      { key: "variacoes", label: "Variações (JSON array)", placeholder: '["João Silva", "J. Silva"]' },
      { key: "termos_bloqueio", label: "Termos de Bloqueio (JSON array)", placeholder: '["homônimo"]' },
      { key: "abrangencias", label: "Abrangências (JSON array)", placeholder: '[{"codEstado": 26}]' },
      { key: "oab", label: "OAB (JSON array)", placeholder: '[{"numero": "12345", "uf": "SP"}]' },
    ],
  },
  {
    id: "delete-pub-term", label: "Excluir Termo", method: "POST", path: "manage-publication-terms",
    category: "management", authType: "jwt",
    description: "Exclui um termo de monitoramento de publicações.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "term_id", label: "ID do Termo", placeholder: "uuid do search_term", required: true },
      { key: "term_type", label: "Tipo do Termo", placeholder: "name ou office", required: true },
      { key: "client_system_id", label: "ID do Sistema Cliente", placeholder: "uuid (opcional)" },
    ],
  },
  {
    id: "list-pub-terms", label: "Listar Termos", method: "POST", path: "manage-search-terms",
    category: "management", authType: "jwt",
    description: "Lista todos os termos cadastrados para publicações em um serviço.",
    params: [],
    bodyParams: [
      { key: "service_id", label: "ID do Serviço", placeholder: "uuid do partner_service", required: true },
      { key: "term_type", label: "Tipo do Termo", placeholder: "name ou office", required: true },
    ],
  },
];

// ─── Action map for management endpoints ──────────────────────
const managementActionMap: Record<string, string> = {
  "register-process": "register",
  "delete-process": "delete",
  "status-process": "status",
  "list-registered-processes": "list",
  "resend-pending-processes": "send-pending",
  "register-dist-term": "register",
  "edit-dist-term": "edit",
  "activate-dist-term": "activate",
  "deactivate-dist-term": "deactivate",
  "delete-dist-term": "delete",
  "list-dist-terms": "list",
  "register-pub-term": "register",
  "edit-pub-term": "edit",
  "delete-pub-term": "delete",
  "list-pub-terms": "list",
};

const ApiTesting = () => {
  const [serviceTab, setServiceTab] = useState("processes");
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef>(processEndpoints[0]);
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
    if (!selectedEndpoint.bodyParams?.length) return null;
    const body: Record<string, any> = {};
    const action = managementActionMap[selectedEndpoint.id];
    if (action) body.action = action;

    for (const p of selectedEndpoint.bodyParams) {
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
    return body;
  };

  const handleTest = async () => {
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
      toast[res.ok ? "success" : "error"](res.ok ? "Requisição executada" : `Erro: ${res.status}`);
    } catch (error: any) {
      setResponse({ status: 0, statusText: "Network Error", data: { error: error.message } });
      toast.error("Erro de rede");
    } finally {
      setIsLoading(false);
    }
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  // Build code examples including body if present
  const queryString = selectedEndpoint.params
    .filter(p => paramValues[p.key])
    .map(p => `${p.key}=${encodeURIComponent(paramValues[p.key])}`)
    .join("&");
  const fullPath = `${selectedEndpoint.path}${queryString ? (selectedEndpoint.path.includes("?") ? "&" : "?") + queryString : ""}`;
  const exampleBody = buildBody();
  const bodyJsonStr = exampleBody ? JSON.stringify(exampleBody, null, 2) : null;
  const isJwt = selectedEndpoint.authType === "jwt";
  const tokenLabel = isJwt ? "SEU_JWT_TOKEN" : (token || "SEU_TOKEN");

  const codeExamples = {
    curl: `curl -X ${exampleBody ? "POST" : selectedEndpoint.method} "${baseUrl}/${fullPath}" \\\n  -H "Authorization: Bearer ${tokenLabel}" \\\n  -H "Content-Type: application/json"${bodyJsonStr ? ` \\\n  -d '${bodyJsonStr}'` : ""}`,
    javascript: `const response = await fetch('${baseUrl}/${fullPath}', {\n  method: '${exampleBody ? "POST" : selectedEndpoint.method}',\n  headers: {\n    'Authorization': 'Bearer ${tokenLabel}',\n    'Content-Type': 'application/json'\n  }${bodyJsonStr ? `,\n  body: JSON.stringify(${bodyJsonStr})` : ""}\n});\nconst data = await response.json();\nconsole.log(data);`,
    python: `import requests\n\nresponse = requests.${(exampleBody ? "post" : selectedEndpoint.method.toLowerCase())}(\n    '${baseUrl}/${fullPath}',\n    headers={\n        'Authorization': 'Bearer ${tokenLabel}',\n        'Content-Type': 'application/json'\n    }${bodyJsonStr ? `,\n    json=${bodyJsonStr}` : ""}\n)\nprint(response.json())`,
  };

  const tabIcons = { processes: <Gavel className="h-4 w-4" />, distributions: <FileSearch className="h-4 w-4" />, publications: <BookOpen className="h-4 w-4" /> };

  const renderEndpointList = (endpoints: EndpointDef[]) => {
    const queryEps = endpoints.filter(ep => ep.category === "query");
    const mgmtEps = endpoints.filter(ep => ep.category === "management");

    return (
      <div className="space-y-2">
        {/* Query endpoints */}
        <div className="flex items-center gap-2 px-1 pt-1">
          <Key className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consulta</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Token</Badge>
        </div>
        {queryEps.map((ep) => (
          <button
            key={ep.id}
            onClick={() => selectEndpoint(ep)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedEndpoint.id === ep.id ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}
          >
            <div className="flex items-center gap-2">
              <Badge variant={ep.method === "POST" ? "default" : "secondary"} className="text-xs font-mono">{ep.method}</Badge>
              <span className="font-medium text-sm">{ep.label}</span>
              {ep.method === "POST" && ep.category === "query" && <CheckCircle className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{ep.description}</p>
          </button>
        ))}

        {/* Separator */}
        {mgmtEps.length > 0 && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center gap-2 px-1">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gerenciamento</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">JWT</Badge>
            </div>
            {mgmtEps.map((ep) => (
              <button
                key={ep.id}
                onClick={() => selectEndpoint(ep)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedEndpoint.id === ep.id ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs font-mono bg-amber-600">{ep.method}</Badge>
                  <span className="font-medium text-sm">{ep.label}</span>
                  <Shield className="h-3.5 w-3.5 text-amber-500 ml-auto" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{ep.description}</p>
              </button>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Playground de API" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Playground de API</h1>
          <p className="text-muted-foreground mt-1">Teste endpoints, visualize respostas e exporte para Postman</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => { downloadPostmanCollection(import.meta.env.VITE_SUPABASE_URL); toast.success("Coleção Postman exportada!"); }}>
          <Download className="h-4 w-4" />Exportar Postman
        </Button>
      </div>

      {/* Token selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Token de Autenticação <span className="text-xs text-muted-foreground">(para endpoints de consulta)</span></Label>
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
              {selectedEndpoint.authType === "jwt" && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Este endpoint usa autenticação JWT do usuário logado (automático)
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service tabs */}
      <Tabs value={serviceTab} onValueChange={(v) => { setServiceTab(v); const eps = v === "processes" ? processEndpoints : v === "distributions" ? distributionEndpoints : publicationEndpoints; selectEndpoint(eps[0]); }}>
        <TabsList>
          <TabsTrigger value="processes" className="gap-2">{tabIcons.processes} Processos</TabsTrigger>
          <TabsTrigger value="distributions" className="gap-2">{tabIcons.distributions} Distribuições</TabsTrigger>
          <TabsTrigger value="publications" className="gap-2">{tabIcons.publications} Publicações</TabsTrigger>
        </TabsList>

        {["processes", "distributions", "publications"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: request config */}
              <div className="space-y-4">
                {/* Endpoint selector */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Endpoints</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderEndpointList(getEndpointsForTab())}
                  </CardContent>
                </Card>

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
                            {p.label} <span className="text-muted-foreground">({p.key})</span>
                            {p.required && <span className="text-destructive ml-1">*</span>}
                          </Label>
                          <Input
                            type={p.type || "text"}
                            value={bodyValues[p.key] || ""}
                            onChange={(e) => setBodyValues({ ...bodyValues, [p.key]: e.target.value })}
                            placeholder={p.placeholder}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Button onClick={handleTest} disabled={isLoading} className="w-full gap-2">
                  <Play className="h-4 w-4" />{isLoading ? "Executando..." : "Executar Requisição"}
                </Button>

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
              </div>

              {/* Right: response */}
              <div className="space-y-4">
                <Card className="sticky top-4">
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
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ApiTesting;
