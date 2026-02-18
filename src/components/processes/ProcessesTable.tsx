import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock, MoreHorizontal, Pencil, Trash2, RefreshCw, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientBadges } from "@/components/shared/ClientBadges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EditProcessDialog } from "@/components/processes/EditProcessDialog";
import { toast } from "sonner";

interface Process {
  id: string;
  process_number: string;
  tribunal: string | null;
  status: string | null;
  status_code: number | null;
  status_description: string | null;
  instance: string | null;
  uf: string | null;
  created_at: string | null;
  last_sync_at: string | null;
  solucionare_status: string;
  partner_service_id: string | null;
  raw_data: any;
  client_processes?: { client_systems: { name: string } }[];
}

const statusColors: Record<number, string> = {
  2: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  4: "bg-green-500/20 text-green-700 border-green-500/30",
  5: "bg-gray-500/20 text-gray-700 border-gray-500/30",
  6: "bg-red-500/20 text-red-700 border-red-500/30",
  7: "bg-destructive/20 text-destructive border-destructive/30",
};

interface ProcessesTableProps {
  searchQuery?: string;
  filterStatus?: string;
}

const STATUS_FILTER_MAP: Record<string, number> = {
  pending: 1, registered: 4, archived: 5, error: 7,
};

export function ProcessesTable({ searchQuery = "", filterStatus = "all" }: ProcessesTableProps) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editProcess, setEditProcess] = useState<Process | null>(null);
  const pageSize = 20;

  useEffect(() => {
    setPage(0);
  }, [searchQuery, filterStatus]);

  useEffect(() => {
    fetchProcesses();
  }, [page, searchQuery, filterStatus]);

  const fetchProcesses = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("processes")
        .select("*, client_processes(client_systems(name))", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchQuery) {
        query = query.or(`process_number.ilike.%${searchQuery}%,tribunal.ilike.%${searchQuery}%`);
      }

      if (filterStatus !== "all" && STATUS_FILTER_MAP[filterStatus]) {
        query = query.eq("status_code", STATUS_FILTER_MAP[filterStatus]);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      
      setProcesses((data as any) || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching processes:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getClientNames = (process: Process): string[] => {
    return process.client_processes
      ?.map((cp: any) => cp.client_systems?.name)
      .filter(Boolean) || [];
  };

  const handleDelete = async (process: Process) => {
    if (!confirm(`Excluir o processo ${process.process_number} do monitoramento?`)) return;
    try {
      const { error } = await supabase.functions.invoke("sync-process-management", {
        body: { action: "delete", processNumber: process.process_number },
      });
      if (error) throw error;
      toast.success("Processo excluído");
      fetchProcesses();
    } catch (error) {
      toast.error("Erro ao excluir processo");
    }
  };

  const handleCheckStatus = async (process: Process) => {
    try {
      toast.info("Verificando status...");
      const { data, error } = await supabase.functions.invoke("sync-process-management", {
        body: { action: "status", processNumber: process.process_number },
      });
      if (error) throw error;
      toast.success(`Status: ${data?.statusDescription || "Verificado"}`);
      fetchProcesses();
    } catch (error) {
      toast.error("Erro ao verificar status");
    }
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
             <TableHead>Número do Processo</TableHead>
             <TableHead>Escritório</TableHead>
             <TableHead>Tribunal</TableHead>
             <TableHead>UF</TableHead>
             <TableHead>Instância</TableHead>
             <TableHead>Status</TableHead>
             <TableHead>Solucionare</TableHead>
             <TableHead>Clientes</TableHead>
             <TableHead>Última Sincronização</TableHead>
             <TableHead className="w-[60px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
             <TableRow>
               <TableCell colSpan={10} className="text-center py-8">
                 <div className="animate-pulse">Carregando...</div>
              </TableCell>
            </TableRow>
          ) : processes.length === 0 ? (
             <TableRow>
               <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                 Nenhum processo encontrado
              </TableCell>
            </TableRow>
          ) : (
            processes.map((process) => {
              const clients = getClientNames(process);
              return (
                <TableRow key={process.id}>
                  <TableCell className="font-mono text-sm">{process.process_number}</TableCell>
                  <TableCell className="text-sm font-medium">{(process as any).cod_escritorio || "-"}</TableCell>
                  <TableCell>{process.tribunal || "-"}</TableCell>
                  <TableCell>{process.uf || "-"}</TableCell>
                  <TableCell>{process.instance || "-"}</TableCell>
                  <TableCell>
                  {(() => {
                    const errorReason = process.raw_data?.descricaoClassificacaoStatus;
                    const hasError = process.status_code === 7 && errorReason;
                    return hasError ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                              <Badge variant="outline" className={statusColors[process.status_code || 0] || ""}>
                                {process.status_description || process.status || "Pendente"}
                              </Badge>
                              <Info className="h-3.5 w-3.5 text-destructive" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-xs font-medium">Motivo: {errorReason}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline" className={statusColors[process.status_code || 0] || ""}>
                        {process.status_description || process.status || "Pendente"}
                      </Badge>
                    );
                  })()}
                   </TableCell>
                   <TableCell>
                     {process.solucionare_status === 'synced' ? (
                       <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 gap-1">
                         <CheckCircle2 className="h-3 w-3" /> Sincronizado
                       </Badge>
                     ) : process.solucionare_status === 'error' ? (
                       <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
                         <AlertCircle className="h-3 w-3" /> Erro
                       </Badge>
                     ) : (
                       <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 gap-1">
                         <Clock className="h-3 w-3" /> Pendente
                       </Badge>
                     )}
                   </TableCell>
                   <TableCell>
                     <ClientBadges clients={clients} />
                   </TableCell>
                   <TableCell className="text-sm text-muted-foreground">
                    {process.last_sync_at
                      ? new Date(process.last_sync_at).toLocaleString("pt-BR")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {process.status_code === 7 && (
                          <DropdownMenuItem onClick={() => setEditProcess(process)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleCheckStatus(process)}>
                          <RefreshCw className="h-4 w-4 mr-2" /> Verificar Status
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(process)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-sm text-muted-foreground">
            Mostrando {page * pageSize + 1} a {Math.min((page + 1) * pageSize, totalCount)} de {totalCount} processos
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <EditProcessDialog
        open={!!editProcess}
        onOpenChange={(open) => { if (!open) setEditProcess(null); }}
        onSuccess={() => { setEditProcess(null); fetchProcesses(); }}
        process={editProcess}
      />
    </div>
  );
}
