import { useState, useEffect, useMemo } from "react";
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
import { Search, Loader2, Download, FileText, RefreshCw, Eye, Clock, FolderOpen, Users, X, Gavel, CircleDot, CheckCircle, Archive, ShieldAlert, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { useNavigate } from "react-router-dom";
import { DateRangePicker } from "@/components/publications/DateRangePicker";
import { ConfirmationBadge } from "@/components/shared/ConfirmationBadge";
import { SyncProgressDialog } from "@/components/processes/SyncProgressDialog";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  status_code: number | null;
  status_description: string | null;
  status: string | null;
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

interface StatusGroup {
  label: string;
  count: number;
  statusCode: number | null;
}

const STATUS_ICON_MAP: Record<number, { icon: typeof CircleDot; colorClass: string }> = {
  1: { icon: Clock, colorClass: "text-warning" },
  2: { icon: Clock, colorClass: "text-warning" },
  4: { icon: CheckCircle, colorClass: "text-success" },
  5: { icon: Archive, colorClass: "text-muted-foreground" },
  6: { icon: ShieldAlert, colorClass: "text-destructive" },
  7: { icon: AlertCircle, colorClass: "text-destructive" },
};
const DEFAULT_ICON = { icon: CircleDot, colorClass: "text-primary" };

async function fetchAllProcesses(searchQuery: string, filterPartner: string, filterClient: string, clientProcessIds: string[] | undefined) {
  if (filterClient !== "all" && clientProcessIds && clientProcessIds.length === 0) return [];

  const PAGE_SIZE = 1000;
  let allData: RegisteredProcess[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("processes")
      .select("id, process_number, tribunal, uf, instance, cod_processo, cod_escritorio, last_sync_at, last_cover_sync_at, partner_id, status_code, status_description, status")
      .order("process_number")
      .range(from, from + PAGE_SIZE - 1);

    if (searchQuery) query = query.or(`process_number.ilike.%${searchQuery}%,tribunal.ilike.%${searchQuery}%,cod_processo::text.ilike.%${searchQuery}%`);
    if (filterPartner !== "all") query = query.eq("partner_id", filterPartner);
    if (filterClient !== "all" && clientProcessIds && clientProcessIds.length > 0) {
      query = query.in("id", clientProcessIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data as RegisteredProcess[]);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

function getStatusLabel(p: RegisteredProcess): string {
  return p.status_description || p.status || "Sem status";
}

export default function ProcessMovements() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("processes");
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterConfirmation, setFilterConfirmation] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [processesPage, setProcessesPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pages when filters change
  useEffect(() => {
    setProcessesPage(1);
    setMovementsPage(1);
  }, [searchQuery, filterPartner, filterClient, filterConfirmation, dateRange, filterStatus]);

  // Reset pages when tab changes
  useEffect(() => {
    setProcessesPage(1);
    setMovementsPage(1);
  }, [activeTab]);

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

  const handleSyncComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["registered-processes"] });
    queryClient.invalidateQueries({ queryKey: ["all-movements"] });
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

  const { data: allProcesses = [], isLoading: loadingProcesses } = useQuery({
    queryKey: ["registered-processes", searchQuery, filterPartner, filterClient, clientProcessIds],
    queryFn: () => fetchAllProcesses(searchQuery, filterPartner, filterClient, clientProcessIds),
  });

  // Compute status groups from all processes
  const statusGroups = useMemo(() => {
    const map = new Map<string, StatusGroup>();
    allProcesses.forEach((p) => {
      const label = getStatusLabel(p);
      if (!map.has(label)) {
        map.set(label, { label, count: 0, statusCode: p.status_code });
      }
      map.get(label)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allProcesses]);

  // Filter processes by selected status
  const processes = useMemo(() => {
    if (filterStatus === "all") return allProcesses;
    return allProcesses.filter((p) => getStatusLabel(p) === filterStatus);
  }, [allProcesses, filterStatus]);

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
    queryKey: ["all-movements", searchQuery, filterPartner, filterClient, filterConfirmation, dateRange, clientProcessIds, confirmedIds.size, filterStatus, processIds],
    queryFn: async () => {
      if (filterClient !== "all" && clientProcessIds && clientProcessIds.length === 0) return [];

      let query = supabase
        .from("process_movements")
        .select("*, processes(process_number, tribunal, partner_id)")
        .order("data_andamento", { ascending: false, nullsFirst: false })
        .limit(500);

      if (searchQuery) query = query.or(`description.ilike.%${searchQuery}%,tipo_andamento.ilike.%${searchQuery}%`);
      if (filterClient !== "all" && clientProcessIds && clientProcessIds.length > 0) {
        query = query.in("process_id", clientProcessIds);
      }
      // Filter movements by status-filtered process IDs
      if (filterStatus !== "all" && processIds.length > 0) {
        query = query.in("process_id", processIds);
      } else if (filterStatus !== "all" && processIds.length === 0) {
        return [];
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

  const hasActiveFilters = searchQuery || filterPartner !== "all" || filterClient !== "all" || filterConfirmation !== "all" || dateRange.from || filterStatus !== "all";

  // Pagination for processes tab
  const totalProcesses = processes.length;
  const totalProcessPages = Math.ceil(totalProcesses / itemsPerPage);
  const paginatedProcesses = processes.slice((processesPage - 1) * itemsPerPage, processesPage * itemsPerPage);

  // Pagination for movements tab
  const totalMovements = movements.length;
  const totalMovementPages = Math.ceil(totalMovements / itemsPerPage);
  const paginatedMovements = movements.slice((movementsPage - 1) * itemsPerPage, movementsPage * itemsPerPage);

  const handleStatusClick = (status: string) => {
    setFilterStatus(status === filterStatus ? "all" : status);
  };

  const renderPagination = (currentPage: number, totalPages: number, totalItems: number, setPage: (p: number) => void, label: string) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4 px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} {label}
        </p>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink onClick={() => setPage(pageNum)} isActive={currentPage === pageNum} className="cursor-pointer">
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Processos", href: "/processes" }, { label: "Andamentos" }]} />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Andamentos</h1>
          <p className="text-muted-foreground mt-1">Dados completos dos processos cadastrados (capas, andamentos, documentos, agrupadores, dependências)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setSyncDialogOpen(true)} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      {/* Status indicator cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            filterStatus === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setFilterStatus("all")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Gavel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allProcesses.length}</div>
            <p className="text-xs text-muted-foreground">Processos cadastrados</p>
          </CardContent>
        </Card>

        {statusGroups.map((g) => {
          const config = (g.statusCode != null && STATUS_ICON_MAP[g.statusCode]) || DEFAULT_ICON;
          const Icon = config.icon;
          return (
            <Card
              key={g.label}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                filterStatus === g.label && "ring-2 ring-primary"
              )}
              onClick={() => handleStatusClick(g.label)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium truncate">{g.label}</CardTitle>
                <Icon className={`h-4 w-4 shrink-0 ${config.colorClass}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{g.count}</div>
                <p className="text-xs text-muted-foreground">
                  {allProcesses.length > 0 ? `${((g.count / allProcesses.length) * 100).toFixed(0)}% do total` : "—"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 md:grid-cols-3">
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
            setFilterStatus("all");
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
                    <TableHead>Código</TableHead>
                     <TableHead>UF</TableHead>
                    <TableHead>Status</TableHead>
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
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8"><FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />Nenhum processo encontrado</TableCell></TableRow>
                  ) : (
                    paginatedProcesses.map((proc) => (
                      <TableRow key={proc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/processes/${proc.id}`)}>
                        <TableCell className="font-mono text-sm">{proc.process_number}</TableCell>
                        <TableCell className="text-sm">{proc.cod_processo || "-"}</TableCell>
                         <TableCell>{proc.uf || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getStatusLabel(proc)}</Badge>
                        </TableCell>
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
              {renderPagination(processesPage, totalProcessPages, totalProcesses, setProcessesPage, "processos")}
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
                    paginatedMovements.map((mov) => (
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
              {renderPagination(movementsPage, totalMovementPages, totalMovements, setMovementsPage, "andamentos")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SyncProgressDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onComplete={handleSyncComplete}
      />
    </div>
  );
}
