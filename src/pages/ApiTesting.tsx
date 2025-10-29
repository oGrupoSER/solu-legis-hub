import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Play, Copy, Code, FileText, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";

const ApiTesting = () => {
  const [endpoint, setEndpoint] = useState("/api-processes");
  const [method, setMethod] = useState("GET");
  const [token, setToken] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [queryParams, setQueryParams] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(0);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const endpoints = [
    { 
      value: "/api-processes", 
      label: "Listar Processos", 
      method: "GET",
      description: "Retorna lista de processos com filtros opcionais",
      params: "limit, offset, process_number, tribunal, status"
    },
    { 
      value: "/api-processes/:id/movements", 
      label: "Movimentações do Processo", 
      method: "GET",
      description: "Retorna movimentações de um processo específico",
      params: "Substituir :id pelo UUID do processo"
    },
    { 
      value: "/api-distributions", 
      label: "Listar Distribuições", 
      method: "GET",
      description: "Retorna lista de distribuições com filtros opcionais",
      params: "limit, offset, process_number, tribunal, date_from, date_to"
    },
    { 
      value: "/api-publications", 
      label: "Listar Publicações", 
      method: "GET",
      description: "Retorna lista de publicações de diários oficiais",
      params: "limit, offset, gazette_name, date_from, date_to, terms"
    },
  ];

  const handleTest = async () => {
    if (!token) {
      toast.error("Token é obrigatório");
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    try {
      let url = `${baseUrl}${endpoint}`;
      if (queryParams) {
        url += `?${queryParams}`;
      }

      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      };

      if (method !== "GET" && requestBody) {
        options.body = requestBody;
      }

      const res = await fetch(url, options);
      const data = await res.json();
      const endTime = Date.now();

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
      });
      setResponseTime(endTime - startTime);

      if (res.ok) {
        toast.success("Requisição executada com sucesso");
      } else {
        toast.error(`Erro: ${res.statusText}`);
      }
    } catch (error: any) {
      setResponse({
        status: 0,
        statusText: "Network Error",
        data: { error: error.message },
      });
      toast.error("Erro ao executar requisição");
    } finally {
      setIsLoading(false);
    }
  };

  const generateToken = async () => {
    const { data } = await supabase.from("api_tokens").select("token").eq("is_active", true).limit(1).single();
    
    if (data) {
      setToken(data.token);
      toast.success("Token carregado");
    } else {
      toast.error("Nenhum token ativo encontrado");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const codeExamples = {
    curl: `curl -X ${method} "${baseUrl}${endpoint}${queryParams ? '?' + queryParams : ''}" \\
  -H "Authorization: Bearer ${token || 'YOUR_TOKEN'}" \\
  -H "Content-Type: application/json"${requestBody ? ` \\\n  -d '${requestBody}'` : ''}`,
    
    javascript: `fetch('${baseUrl}${endpoint}${queryParams ? '?' + queryParams : ''}', {
  method: '${method}',
  headers: {
    'Authorization': 'Bearer ${token || 'YOUR_TOKEN'}',
    'Content-Type': 'application/json'
  }${requestBody ? `,\n  body: JSON.stringify(${requestBody})` : ''}
})
.then(res => res.json())
.then(data => console.log(data));`,

    python: `import requests

response = requests.${method.toLowerCase()}(
    '${baseUrl}${endpoint}${queryParams ? '?' + queryParams : ''}',
    headers={
        'Authorization': 'Bearer ${token || 'YOUR_TOKEN'}',
        'Content-Type': 'application/json'
    }${requestBody ? `,\n    json=${requestBody}` : ''}
)
print(response.json())`,
  };

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Playground de API" },
        ]}
      />
      
      <div>
        <h1 className="text-3xl font-bold text-foreground">Playground de API</h1>
        <p className="text-muted-foreground mt-1">
          Teste os endpoints da API e gere exemplos de código
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração da Requisição</CardTitle>
              <CardDescription>Configure os parâmetros da sua requisição</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Endpoint</Label>
                <Select 
                  value={endpoint} 
                  onValueChange={(value) => {
                    setEndpoint(value);
                    const selected = endpoints.find(e => e.value === value);
                    if (selected) {
                      setQueryParams(selected.params || "");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {endpoints.map((ep) => (
                      <SelectItem key={ep.value} value={ep.value}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {ep.method}
                          </Badge>
                          {ep.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {endpoints.find(e => e.value === endpoint)?.description && (
                  <p className="text-xs text-muted-foreground">
                    {endpoints.find(e => e.value === endpoint)?.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Token de Autenticação</Label>
                  <Button variant="outline" size="sm" onClick={generateToken}>
                    Usar Token Existente
                  </Button>
                </div>
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Bearer token..."
                  type="password"
                />
              </div>

              <div className="space-y-2">
                <Label>Query Parameters (opcional)</Label>
                <Input
                  value={queryParams}
                  onChange={(e) => setQueryParams(e.target.value)}
                  placeholder="limit=10&offset=0"
                />
              </div>

              {method !== "GET" && (
                <div className="space-y-2">
                  <Label>Request Body (JSON)</Label>
                  <Textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              <Button onClick={handleTest} disabled={isLoading} className="w-full gap-2">
                <Play className="h-4 w-4" />
                {isLoading ? "Executando..." : "Executar Requisição"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Exemplos de Código
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="curl">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                </TabsList>
                <TabsContent value="curl" className="space-y-2">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{codeExamples.curl}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(codeExamples.curl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="javascript" className="space-y-2">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{codeExamples.javascript}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(codeExamples.javascript)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="python" className="space-y-2">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{codeExamples.python}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(codeExamples.python)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resposta
                </CardTitle>
                {response && (
                  <div className="flex items-center gap-2">
                    <Badge variant={response.status >= 200 && response.status < 300 ? "default" : "destructive"}>
                      {response.status} {response.statusText}
                    </Badge>
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
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto max-h-[600px]">
                    <code>{JSON.stringify(response.data, null, 2)}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(JSON.stringify(response.data, null, 2))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ApiTesting;
