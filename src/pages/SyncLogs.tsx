import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { SyncStatusBadge } from "@/components/sync-logs/StatusBadges";
import { ApiCallRow, type ApiCallLog } from "@/components/sync-logs/ApiCallRow";

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_synced: number;
  error_message: string | null;
  partner_id: string | null;
  partner_service_id: string | null;
  partners?: { name: string };
  partner_services?: { service_name: string };
}

const SyncLogs = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [apiCalls, setApiCalls] = useState<ApiCallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sync");

  useEffect(() => {
    fetchLogs();
    fetchApiCalls();

    const channel = supabase
      .channel('sync-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_logs' }, () => fetchLogs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'api_call_logs' }, () => fetchApiCalls())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*, partners(name), partner_services(service_name)")
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogs(data || []);
    } catch {
      toast.error("Erro ao carregar logs");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchApiCalls = async () => {
    try {
      const { data, error } = await supabase
        .from("api_call_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setApiCalls((data as ApiCallLog[]) || []);
    } catch {
      console.error("Erro ao carregar chamadas API");
    }
  };

  const getDuration = (startedAt: string, completedAt: string | null) => {
    if (!completedAt) return "-";
    const diff = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    return `${diff}s`;
  };

  const filteredLogs = logs.filter((log) => {
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    if (filterType !== "all" && log.sync_type !== filterType) return false;
    return true;
  });

  const getCallsForLog = (logId: string) => apiCalls.filter(c => c.sync_log_id === logId);
  const orphanCalls = apiCalls.filter(c => !c.sync_log_id);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Logs de Sincronização" },
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Logs de Sincronização</h1>
          <p className="text-muted-foreground mt-1">Histórico de sincronizações e chamadas de API</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              try {
                await supabase.functions.invoke("sync-orchestrator", { body: { mode: "parallel" } });
                toast.success("Sincronização geral iniciada");
              } catch {
                toast.error("Erro ao iniciar sincronização");
              }
            }}
            variant="default"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar Tudo
          </Button>
          <Button onClick={() => { fetchLogs(); fetchApiCalls(); }} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sync">Sincronizações ({filteredLogs.length})</TabsTrigger>
          <TabsTrigger value="api">Chamadas API ({apiCalls.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4 pb-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="in_progress">Em Execução</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="processes_list">Listagem Processos</SelectItem>
                  <SelectItem value="process_updates_full">Atualização Processos</SelectItem>
                  <SelectItem value="process_register">Cadastro Processo</SelectItem>
                  <SelectItem value="publications">Publicações</SelectItem>
                  <SelectItem value="distributions">Distribuições</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead className="text-right">Registros</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum log encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => {
                        const calls = getCallsForLog(log.id);
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <SyncLogRowWithCalls
                            key={log.id}
                            log={log}
                            calls={calls}
                            isExpanded={isExpanded}
                            onToggle={() => setExpandedLogId(isExpanded ? null : log.id)}
                            getDuration={getDuration}
                          />
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Todas as Chamadas API</CardTitle>
              <CardDescription>Registro detalhado de todas as requisições REST e SOAP para parceiros</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Resumo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiCalls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma chamada API registrada ainda. Execute uma sincronização para gerar logs.
                        </TableCell>
                      </TableRow>
                    ) : (
                      apiCalls.map((call) => (
                        <ApiCallRow key={call.id} call={call} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Sub-component for sync log row with expandable API calls
interface SyncLogRowWithCallsProps {
  log: SyncLog;
  calls: ApiCallLog[];
  isExpanded: boolean;
  onToggle: () => void;
  getDuration: (s: string, e: string | null) => string;
}

const SyncLogRowWithCalls = ({ log, calls, isExpanded, onToggle, getDuration }: SyncLogRowWithCallsProps) => {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8 px-2">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {calls.length > 0 ? (
              isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            ) : (
              <span className="h-3 w-3" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium text-sm">{log.sync_type}</TableCell>
        <TableCell className="text-sm">{(log as any).partner_services?.service_name || log.partners?.name || "-"}</TableCell>
        <TableCell><SyncStatusBadge status={log.status} /></TableCell>
        <TableCell className="text-sm">
          {format(new Date(log.started_at), "dd/MM/yyyy HH:mm:ss")}
        </TableCell>
        <TableCell className="text-sm">{getDuration(log.started_at, log.completed_at)}</TableCell>
        <TableCell className="text-right font-medium">{log.records_synced || 0}</TableCell>
        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
          {log.error_message || "-"}
        </TableCell>
      </TableRow>
      {isExpanded && calls.length > 0 && (
        <TableRow>
          <TableCell colSpan={8} className="p-0">
            <div className="bg-muted/20 border-y">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                {calls.length} chamada(s) API nesta sincronização
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-xs">Método</TableHead>
                    <TableHead className="text-xs">Endpoint</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Hora</TableHead>
                    <TableHead className="text-xs">Duração</TableHead>
                    <TableHead className="text-xs">Resumo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <ApiCallRow key={call.id} call={call} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
      {isExpanded && calls.length === 0 && (
        <TableRow>
          <TableCell colSpan={8} className="text-center text-muted-foreground py-4 bg-muted/20 text-sm">
            Nenhuma chamada API registrada para esta sincronização
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default SyncLogs;
