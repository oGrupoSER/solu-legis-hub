import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Play, Copy, Code, FileText, Download, Gavel, FileSearch, BookOpen, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { downloadPostmanCollection } from "@/lib/postman-collection";
import { useQuery } from "@tanstack/react-query";

interface EndpointDef {
  id: string;
  label: string;
  method: string;
  description: string;
  path: string;
  params: Array<{ key: string; label: string; placeholder: string; type?: string }>;
}

const processEndpoints: EndpointDef[] = [
  {
    id: "list-processes", label: "Listar Processos", method: "GET", path: "api-processes",
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
    description: "Retorna detalhes completos de um processo. Use include para sub-recursos.",
    params: [
      { key: "id", label: "ID do Processo (UUID)", placeholder: "uuid" },
      { key: "include", label: "Incluir (separado por vírgula)", placeholder: "movements,documents,parties,cover,groupers" },
    ],
  },
  {
    id: "confirm-processes", label: "Confirmar Lote", method: "POST", path: "api-processes?action=confirm",
    description: "Confirma recebimento do último lote de processos para liberar novos registros.",
    params: [],
  },
];

const distributionEndpoints: EndpointDef[] = [
  {
    id: "list-distributions", label: "Listar Distribuições", method: "GET", path: "api-distributions",
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
    description: "Retorna detalhes de uma distribuição específica.",
    params: [{ key: "id", label: "ID da Distribuição (UUID)", placeholder: "uuid" }],
  },
  {
    id: "confirm-distributions", label: "Confirmar Lote", method: "POST", path: "api-distributions?action=confirm",
    description: "Confirma recebimento do último lote de distribuições.",
    params: [],
  },
];

const publicationEndpoints: EndpointDef[] = [
  {
    id: "list-publications", label: "Listar Publicações", method: "GET", path: "api-publications",
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
    description: "Retorna detalhes de uma publicação específica.",
    params: [{ key: "id", label: "ID da Publicação (UUID)", placeholder: "uuid" }],
  },
  {
    id: "confirm-publications", label: "Confirmar Lote", method: "POST", path: "api-publications?action=confirm",
    description: "Confirma recebimento do último lote de publicações.",
    params: [],
  },
];

const ApiTesting = () => {
  const [serviceTab, setServiceTab] = useState("processes");
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef>(processEndpoints[0]);
  const [token, setToken] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
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

  const handleTest = async () => {
    if (!token) { toast.error("Selecione ou insira um token"); return; }
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const url = buildUrl();
      const res = await fetch(url, {
        method: selectedEndpoint.method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
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

  const queryString = selectedEndpoint.params
    .filter(p => paramValues[p.key])
    .map(p => `${p.key}=${encodeURIComponent(paramValues[p.key])}`)
    .join("&");
  const fullPath = `${selectedEndpoint.path}${queryString ? (selectedEndpoint.path.includes("?") ? "&" : "?") + queryString : ""}`;

  const codeExamples = {
    curl: `curl -X ${selectedEndpoint.method} "${baseUrl}/${fullPath}" \\\n  -H "Authorization: Bearer ${token || 'SEU_TOKEN'}" \\\n  -H "Content-Type: application/json"`,
    javascript: `const response = await fetch('${baseUrl}/${fullPath}', {\n  method: '${selectedEndpoint.method}',\n  headers: {\n    'Authorization': 'Bearer ${token || 'SEU_TOKEN'}',\n    'Content-Type': 'application/json'\n  }\n});\nconst data = await response.json();\nconsole.log(data);`,
    python: `import requests\n\nresponse = requests.${selectedEndpoint.method.toLowerCase()}(\n    '${baseUrl}/${fullPath}',\n    headers={\n        'Authorization': 'Bearer ${token || 'SEU_TOKEN'}',\n        'Content-Type': 'application/json'\n    }\n)\nprint(response.json())`,
  };

  const tabIcons = { processes: <Gavel className="h-4 w-4" />, distributions: <FileSearch className="h-4 w-4" />, publications: <BookOpen className="h-4 w-4" /> };

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
              <Label>Token de Autenticação</Label>
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
                  <CardContent className="space-y-2">
                    {getEndpointsForTab().map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => selectEndpoint(ep)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedEndpoint.id === ep.id ? "bg-primary/10 border-primary" : "hover:bg-muted"}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={ep.method === "POST" ? "default" : "secondary"} className="text-xs font-mono">{ep.method}</Badge>
                          <span className="font-medium text-sm">{ep.label}</span>
                          {ep.method === "POST" && <CheckCircle className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{ep.description}</p>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Parameters */}
                {selectedEndpoint.params.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Parâmetros</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedEndpoint.params.map((p) => (
                        <div key={p.key} className="space-y-1">
                          <Label className="text-xs">{p.label} <span className="text-muted-foreground">({p.key})</span></Label>
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
                        {/* Rate limit info */}
                        {response.headers?.["X-RateLimit-Limit"] && (
                          <div className="flex gap-2 text-xs">
                            <Badge variant="outline">Limit: {response.headers["X-RateLimit-Limit"]}</Badge>
                            <Badge variant="outline">Remaining: {response.headers["X-RateLimit-Remaining"]}</Badge>
                          </div>
                        )}
                        {/* Batch info */}
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
