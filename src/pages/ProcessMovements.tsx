import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Loader2, Download, FileText, RefreshCw, Eye, Clock, FolderOpen, Users, X } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { useNavigate } from "react-router-dom";
import { DateRangePicker } from "@/components/publications/DateRangePicker";
import { ConfirmationBadge } from "@/components/shared/ConfirmationBadge";

interface RegisteredProcess {
  id: string;
  process_number: string;
  tribunal: string | null;
  uf: string | null;
  instance: string | null;
  cod_processo: number | null;
  cod_escritorio: number | null;
  last_sync_at: string | null;
  last_cover_sync_at: string | null;
  partner_id: string | null;
}

interface Movement {
  id: string;
  process_id: string | null;
  description: string | null;
  movement_type: string | null;
  tipo_andamento: string | null;
  data_andamento: string | null;
  cod_andamento: number | null;
  created_at: string | null;
  processes?: { process_number: string; tribunal: string | null; partner_id: string | null } | null;
}

export default function ProcessMovements() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("processes");
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterConfirmation, setFilterConfirmation] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchConfirmed = async () => {
      const { data } = await supabase
        .from("record_confirmations")
        .select("record_id")
        .eq("record_type", "movements");
      setConfirmedIds(new Set((data || []).map(c => c.record_id)));
    };
    fetchConfirmed();
  }, []);

  const { data: partners } = useQuery({
    queryKey: ["partners-filter-movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-filter-movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_systems").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const handleSync = async () => {
    try {
      setSyncing(true);
      toast.info("Sincronizando andamentos, documentos, capas...");
      const { data, error } = await supabase.functions.invoke("sync-process-updates", { body: { syncType: "full" } });
      if (error) throw error;
      const results = data?.results || [];
      const totalSynced = results.reduce((acc: number, r: any) => acc + (r.recordsSynced || 0), 0);
      toast.success(`Sincronização concluída: ${totalSynced} registros sincronizados`);
      queryClient.invalidateQueries({ queryKey: ["registered-processes"] });
      queryClient.invalidateQueries({ queryKey: ["all-movements"] });
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar andamentos");
    } finally {
      setSyncing(false);
    }
  };

  // Fetch client process IDs for filtering
  const { data: clientProcessIds } = useQuery({
    queryKey: ["client-process-ids", filterClient],
    enabled: filterClient !== "all",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_processes")
        .select("process_id")
        .eq("client_system_id", filterClient);
      if (error) throw error;
      return (data || []).map(cp => cp.process_id);
    },
  });

  const { data: processes = [], isLoading: loadingProcesses } = useQuery({
    queryKey: ["registered-processes", searchQuery, filterPartner, filterClient, clientProcessIds],
    queryFn: async () => {
      if (filterClient !== "all" && clientProcessIds && clientProcessIds.length === 0) return [];

      let query = supabase
        .from("processes")
        .select("id, process_number, tribunal, uf, instance, cod_processo, cod_escritorio, last_sync_at, last_cover_sync_at, partner_id")
        .eq("status_code", 4)
        .order("process_number");

      if (searchQuery) query = query.or(`process_number.ilike.%${searchQuery}%,tribunal.ilike.%${searchQuery}%`);
      if (filterPartner !== "all") query = query.eq("partner_id", filterPartner);
      if (filterClient !== "all" && clientProcessIds && clientProcessIds.length > 0) {
        query = query.in("id", clientProcessIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RegisteredProcess[];
    },
  });

  const processIds = processes.map((p) => p.id);

  const { data: movementCounts = {} } = useQuery({
    queryKey: ["movement-counts", processIds],
    enabled: processIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("process_movements").select("process_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((d) => { if (d.process_id) counts[d.process_id] = (counts[d.process_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: documentCounts = {} } = useQuery({
    queryKey: ["document-counts", processIds],
    enabled: processIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("process_documents").select("process_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((d) => { if (d.process_id) counts[d.process_id] = (counts[d.process_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["all-movements", searchQuery, filterPartner, filterClient, filterConfirmation, dateRange, clientProcessIds, confirmedIds.size],
    queryFn: async () => {
      if (filterClient !== "all" && clientProcessIds && clientProcessIds.length === 0) return [];

      let query = supabase
        .from("process_movements")
        .select("*, processes(process_number, tribunal, partner_id)")
        .order("data_andamento", { ascending: false, nullsFirst: false })
        .limit(200);

      if (searchQuery) query = query.or(`description.ilike.%${searchQuery}%,tipo_andamento.ilike.%${searchQuery}%`);
      if (filterClient !== "all" && clientProcessIds && clientProcessIds.length > 0) {
        query = query.in("process_id", clientProcessIds);
      }
      if (dateRange.from) query = query.gte("data_andamento", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange.to) query = query.lte("data_andamento", format(dateRange.to, "yyyy-MM-dd"));

      if (filterConfirmation === "confirmed") {
        const ids = Array.from(confirmedIds);
        if (ids.length === 0) return [];
        query = query.in("id", ids);
      } else if (filterConfirmation === "not_confirmed" && confirmedIds.size > 0) {
        query = query.not("id", "in", `(${Array.from(confirmedIds).join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by partner on the client side (partner_id is on processes, not movements)
      if (filterPartner !== "all") {
        return (data || []).filter((m: any) => m.processes?.partner_id === filterPartner) as unknown as Movement[];
      }

      return data as unknown as Movement[];
    },
  });

  const { data: movDocCounts = {} } = useQuery({
    queryKey: ["movement-doc-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("process_documents").select("movement_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((d) => { if (d.movement_id) counts[d.movement_id] = (counts[d.movement_id] || 0) + 1; });
      return counts;
    },
  });

  const handleExport = () => {
    const csv = [
      ["Processo", "Tribunal", "Tipo", "Descrição", "Data", "Documentos"],
      ...movements.map((m) => [
        (m.processes as any)?.process_number || "-",
        (m.processes as any)?.tribunal || "-",
        m.tipo_andamento || m.movement_type || "-",
        (m.description || "").replace(/,/g, ";").substring(0, 100),
        m.data_andamento ? format(new Date(m.data_andamento), "dd/MM/yyyy", { locale: ptBR }) : "-",
        movDocCounts[m.id] || 0,
      ]),
    ].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `andamentos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Exportado com sucesso");
  };

  const hasActiveFilters = searchQuery || filterPartner !== "all" || filterClient !== "all" || filterConfirmation !== "all" || dateRange.from;

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Processos", href: "/processes" }, { label: "Andamentos" }]} />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Andamentos</h1>
          <p className="text-muted-foreground mt-1">Dados completos dos processos cadastrados (capas, andamentos, documentos, agrupadores, dependências)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} variant="outline" size="sm" className="gap-2" disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Processos Cadastrados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{processes.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Andamentos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{movements.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Documentos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{Object.values(documentCounts).reduce((a, b) => a + b, 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Com Andamentos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{processes.filter((p) => movementCounts[p.id]).length}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        <DateRangePicker from={dateRange.from} to={dateRange.to} onSelect={(range) => setDateRange(range)} />

        <Select value={filterPartner} onValueChange={setFilterPartner}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Parceiro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Parceiros</SelectItem>
            {partners?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterConfirmation} onValueChange={setFilterConfirmation}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Confirmação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="not_confirmed">Não confirmados</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={() => {
            setSearchQuery("");
            setFilterPartner("all");
            setFilterClient("all");
            setFilterConfirmation("all");
            setDateRange({ from: undefined, to: undefined });
          }} title="Limpar filtros">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="processes" className="gap-2"><Users className="h-4 w-4" /> Processos</TabsTrigger>
          <TabsTrigger value="movements" className="gap-2"><Clock className="h-4 w-4" /> Andamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="processes">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número do Processo</TableHead>
                    <TableHead>Escritório</TableHead>
                    <TableHead>Tribunal</TableHead>
                    <TableHead>UF</TableHead>
                    <TableHead>Andamentos</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead className="w-[60px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProcesses ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : processes.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8"><FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />Nenhum processo com status Cadastrado</TableCell></TableRow>
                  ) : (
                    processes.map((proc) => (
                      <TableRow key={proc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/processes/${proc.id}`)}>
                        <TableCell className="font-mono text-sm">{proc.process_number}</TableCell>
                        <TableCell>{proc.cod_escritorio || "-"}</TableCell>
                        <TableCell>{proc.tribunal || "-"}</TableCell>
                        <TableCell>{proc.uf || "-"}</TableCell>
                        <TableCell><Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {movementCounts[proc.id] || 0}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="gap-1"><FolderOpen className="h-3 w-3" /> {documentCounts[proc.id] || 0}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{proc.last_sync_at ? new Date(proc.last_sync_at).toLocaleString("pt-BR") : "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/processes/${proc.id}`); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Processo</TableHead>
                    <TableHead>Tribunal</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="max-w-[300px]">Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Docs</TableHead>
                    <TableHead className="w-[80px]">Confirm.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMovements ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : movements.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8"><FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />Nenhum andamento encontrado</TableCell></TableRow>
                  ) : (
                    movements.map((mov) => (
                      <TableRow key={mov.id} className="cursor-pointer hover:bg-muted/50" onClick={() => mov.process_id && navigate(`/processes/${mov.process_id}`)}>
                        <TableCell className="font-mono text-sm">{(mov.processes as any)?.process_number || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{(mov.processes as any)?.tribunal || "-"}</Badge></TableCell>
                        <TableCell><Badge variant="secondary">{mov.tipo_andamento || mov.movement_type || "-"}</Badge></TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">{mov.description || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {mov.data_andamento ? format(new Date(mov.data_andamento), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell>
                          {movDocCounts[mov.id] ? (
                            <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> {movDocCounts[mov.id]}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ConfirmationBadge recordId={mov.id} recordType="movements" isConfirmed={confirmedIds.has(mov.id)} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
