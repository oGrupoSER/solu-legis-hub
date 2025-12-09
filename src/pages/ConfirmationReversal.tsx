import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Newspaper, Gavel, FileText } from "lucide-react";

interface ReversalStats {
  publications: { total: number; pending: number };
  processes: { total: number; pending: number };
  documents: { total: number; pending: number };
}

interface PartnerService {
  id: string;
  service_name: string;
  service_type: string;
  partner_id: string;
  partners?: { name: string };
}

const ConfirmationReversal = () => {
  const [stats, setStats] = useState<ReversalStats>({
    publications: { total: 0, pending: 0 },
    processes: { total: 0, pending: 0 },
    documents: { total: 0, pending: 0 },
  });
  const [services, setServices] = useState<PartnerService[]>([]);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentOperation, setCurrentOperation] = useState("");
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: [],
  });

  useEffect(() => {
    fetchServices();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [selectedService]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from("partner_services")
      .select("id, service_name, service_type, partner_id, partners(name)")
      .in("service_type", ["publications", "processes", "distributions"])
      .eq("is_active", true);

    if (!error && data) {
      setServices(data as PartnerService[]);
    }
  };

  const fetchStats = async () => {
    setIsLoading(true);

    try {
      // Publications count
      let pubQuery = supabase.from("publications").select("id", { count: "exact", head: true });
      if (selectedService !== "all") {
        pubQuery = pubQuery.eq("partner_service_id", selectedService);
      }
      const { count: pubCount } = await pubQuery;

      // Processes count
      let procQuery = supabase.from("processes").select("id", { count: "exact", head: true });
      if (selectedService !== "all") {
        procQuery = procQuery.eq("partner_service_id", selectedService);
      }
      const { count: procCount } = await procQuery;

      // Documents count
      const { count: docCount } = await supabase
        .from("process_documents")
        .select("id", { count: "exact", head: true });

      setStats({
        publications: { total: pubCount || 0, pending: pubCount || 0 },
        processes: { total: procCount || 0, pending: procCount || 0 },
        documents: { total: docCount || 0, pending: docCount || 0 },
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevertPublications = async () => {
    setIsReverting(true);
    setProgress(0);
    setCurrentOperation("Buscando publicações para reversão...");
    setResults({ success: 0, failed: 0, errors: [] });

    try {
      let query = supabase.from("publications").select("cod_publicacao, partner_service_id");
      if (selectedService !== "all") {
        query = query.eq("partner_service_id", selectedService);
      }
      const { data: publications, error } = await query;

      if (error) throw error;
      if (!publications || publications.length === 0) {
        toast.info("Nenhuma publicação encontrada para reversão");
        return;
      }

      // Group by partner_service_id
      const groupedByService = publications.reduce((acc, pub) => {
        if (pub.partner_service_id && pub.cod_publicacao) {
          if (!acc[pub.partner_service_id]) acc[pub.partner_service_id] = [];
          acc[pub.partner_service_id].push(pub.cod_publicacao);
        }
        return acc;
      }, {} as Record<string, number[]>);

      let totalSuccess = 0;
      let totalFailed = 0;
      const errors: string[] = [];
      let processed = 0;
      const total = Object.keys(groupedByService).length;

      for (const [serviceId, codes] of Object.entries(groupedByService)) {
        setCurrentOperation(`Revertendo ${codes.length} publicações do serviço...`);
        
        try {
          const { data, error: funcError } = await supabase.functions.invoke("revert-confirmations", {
            body: {
              type: "publications",
              partner_service_id: serviceId,
              codes: codes,
            },
          });

          if (funcError) {
            errors.push(`Serviço ${serviceId}: ${funcError.message}`);
            totalFailed += codes.length;
          } else {
            totalSuccess += data?.success || codes.length;
            totalFailed += data?.failed || 0;
            if (data?.errors) errors.push(...data.errors);
          }
        } catch (e) {
          errors.push(`Erro no serviço ${serviceId}: ${e instanceof Error ? e.message : "Erro desconhecido"}`);
          totalFailed += codes.length;
        }

        processed++;
        setProgress((processed / total) * 100);
      }

      setResults({ success: totalSuccess, failed: totalFailed, errors });
      toast.success(`Reversão concluída: ${totalSuccess} sucesso, ${totalFailed} falhas`);
    } catch (error) {
      console.error("Error reverting publications:", error);
      toast.error("Erro ao reverter publicações");
    } finally {
      setIsReverting(false);
      setCurrentOperation("");
      fetchStats();
    }
  };

  const handleRevertProcesses = async () => {
    setIsReverting(true);
    setProgress(0);
    setCurrentOperation("Buscando processos para reversão...");
    setResults({ success: 0, failed: 0, errors: [] });

    try {
      let query = supabase.from("processes").select("cod_processo, partner_service_id");
      if (selectedService !== "all") {
        query = query.eq("partner_service_id", selectedService);
      }
      const { data: processes, error } = await query;

      if (error) throw error;
      if (!processes || processes.length === 0) {
        toast.info("Nenhum processo encontrado para reversão");
        return;
      }

      const groupedByService = processes.reduce((acc, proc) => {
        if (proc.partner_service_id && proc.cod_processo) {
          if (!acc[proc.partner_service_id]) acc[proc.partner_service_id] = [];
          acc[proc.partner_service_id].push(proc.cod_processo);
        }
        return acc;
      }, {} as Record<string, number[]>);

      let totalSuccess = 0;
      let totalFailed = 0;
      const errors: string[] = [];
      let processed = 0;
      const total = Object.keys(groupedByService).length;

      for (const [serviceId, codes] of Object.entries(groupedByService)) {
        setCurrentOperation(`Revertendo ${codes.length} processos do serviço...`);

        try {
          const { data, error: funcError } = await supabase.functions.invoke("revert-confirmations", {
            body: {
              type: "processes",
              partner_service_id: serviceId,
              codes: codes,
            },
          });

          if (funcError) {
            errors.push(`Serviço ${serviceId}: ${funcError.message}`);
            totalFailed += codes.length;
          } else {
            totalSuccess += data?.success || codes.length;
            totalFailed += data?.failed || 0;
            if (data?.errors) errors.push(...data.errors);
          }
        } catch (e) {
          errors.push(`Erro no serviço ${serviceId}: ${e instanceof Error ? e.message : "Erro desconhecido"}`);
          totalFailed += codes.length;
        }

        processed++;
        setProgress((processed / total) * 100);
      }

      setResults({ success: totalSuccess, failed: totalFailed, errors });
      toast.success(`Reversão concluída: ${totalSuccess} sucesso, ${totalFailed} falhas`);
    } catch (error) {
      console.error("Error reverting processes:", error);
      toast.error("Erro ao reverter processos");
    } finally {
      setIsReverting(false);
      setCurrentOperation("");
      fetchStats();
    }
  };

  const handleRevertDocuments = async () => {
    setIsReverting(true);
    setProgress(0);
    setCurrentOperation("Buscando documentos para reversão...");
    setResults({ success: 0, failed: 0, errors: [] });

    try {
      // Get documents with their process's partner_service_id
      const { data: documents, error } = await supabase
        .from("process_documents")
        .select("cod_documento, process_id, processes(partner_service_id)");

      if (error) throw error;
      if (!documents || documents.length === 0) {
        toast.info("Nenhum documento encontrado para reversão");
        return;
      }

      const groupedByService = documents.reduce((acc, doc) => {
        const serviceId = (doc.processes as any)?.partner_service_id;
        if (serviceId && doc.cod_documento) {
          if (!acc[serviceId]) acc[serviceId] = [];
          acc[serviceId].push(doc.cod_documento);
        }
        return acc;
      }, {} as Record<string, number[]>);

      let totalSuccess = 0;
      let totalFailed = 0;
      const errors: string[] = [];
      let processed = 0;
      const total = Object.keys(groupedByService).length;

      for (const [serviceId, codes] of Object.entries(groupedByService)) {
        setCurrentOperation(`Revertendo ${codes.length} documentos do serviço...`);

        try {
          const { data, error: funcError } = await supabase.functions.invoke("revert-confirmations", {
            body: {
              type: "documents",
              partner_service_id: serviceId,
              codes: codes,
            },
          });

          if (funcError) {
            errors.push(`Serviço ${serviceId}: ${funcError.message}`);
            totalFailed += codes.length;
          } else {
            totalSuccess += data?.success || codes.length;
            totalFailed += data?.failed || 0;
            if (data?.errors) errors.push(...data.errors);
          }
        } catch (e) {
          errors.push(`Erro no serviço ${serviceId}: ${e instanceof Error ? e.message : "Erro desconhecido"}`);
          totalFailed += codes.length;
        }

        processed++;
        setProgress((processed / total) * 100);
      }

      setResults({ success: totalSuccess, failed: totalFailed, errors });
      toast.success(`Reversão concluída: ${totalSuccess} sucesso, ${totalFailed} falhas`);
    } catch (error) {
      console.error("Error reverting documents:", error);
      toast.error("Erro ao reverter documentos");
    } finally {
      setIsReverting(false);
      setCurrentOperation("");
      fetchStats();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reversão de Confirmações</h1>
        <p className="text-muted-foreground">
          Reverte a confirmação de recebimento na Solucionare para que os dados sejam disponibilizados novamente
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Atenção:</strong> Esta operação irá reverter as confirmações na API da Solucionare. 
          Use apenas quando necessário migrar dados para o sistema legado.
        </AlertDescription>
      </Alert>

      {/* Service Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtrar por Serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="Todos os serviços" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.partners?.name} - {service.service_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Progress */}
      {isReverting && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{currentOperation}</span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {(results.success > 0 || results.failed > 0) && !isReverting && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resultado da Última Operação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                {results.success} Sucesso
              </Badge>
              {results.failed > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {results.failed} Falhas
                </Badge>
              )}
            </div>
            {results.errors.length > 0 && (
              <div className="space-y-1 text-sm text-destructive">
                {results.errors.slice(0, 5).map((error, i) => (
                  <p key={i}>• {error}</p>
                ))}
                {results.errors.length > 5 && (
                  <p className="text-muted-foreground">... e mais {results.errors.length - 5} erros</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs for each type */}
      <Tabs defaultValue="publications" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="publications" className="flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            Publicações
          </TabsTrigger>
          <TabsTrigger value="processes" className="flex items-center gap-2">
            <Gavel className="h-4 w-4" />
            Processos
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="publications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                Publicações
              </CardTitle>
              <CardDescription>
                Reverte a confirmação de publicações para que sejam disponibilizadas novamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.publications.total.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">publicações na base</p>
                </div>
                <Button
                  onClick={handleRevertPublications}
                  disabled={isReverting || stats.publications.total === 0}
                  variant="destructive"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isReverting ? "animate-spin" : ""}`} />
                  Reverter Todas
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                Processos
              </CardTitle>
              <CardDescription>
                Reverte a confirmação de processos para que sejam disponibilizados novamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.processes.total.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">processos na base</p>
                </div>
                <Button
                  onClick={handleRevertProcesses}
                  disabled={isReverting || stats.processes.total === 0}
                  variant="destructive"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isReverting ? "animate-spin" : ""}`} />
                  Reverter Todos
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos
              </CardTitle>
              <CardDescription>
                Reverte a confirmação de documentos para que sejam disponibilizados novamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.documents.total.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">documentos na base</p>
                </div>
                <Button
                  onClick={handleRevertDocuments}
                  disabled={isReverting || stats.documents.total === 0}
                  variant="destructive"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isReverting ? "animate-spin" : ""}`} />
                  Reverter Todos
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfirmationReversal;
