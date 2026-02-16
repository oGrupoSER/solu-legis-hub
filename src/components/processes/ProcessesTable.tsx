import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientBadges } from "@/components/shared/ClientBadges";

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
  client_processes?: { client_systems: { name: string } }[];
}

const statusColors: Record<number, string> = {
  2: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  4: "bg-green-500/20 text-green-700 border-green-500/30",
  5: "bg-gray-500/20 text-gray-700 border-gray-500/30",
  6: "bg-red-500/20 text-red-700 border-red-500/30",
  7: "bg-destructive/20 text-destructive border-destructive/30",
};

export function ProcessesTable() {
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchProcesses();
  }, [page, search]);

  const fetchProcesses = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("processes")
        .select("*, client_processes(client_systems(name))", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        query = query.or(`process_number.ilike.%${search}%,tribunal.ilike.%${search}%`);
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

  return (
    <div className="space-y-4">
      <div className="p-4 border-b">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou tribunal..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número do Processo</TableHead>
            <TableHead>Tribunal</TableHead>
            <TableHead>UF</TableHead>
            <TableHead>Instância</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Clientes</TableHead>
            <TableHead>Última Sincronização</TableHead>
            <TableHead className="w-[80px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                <div className="animate-pulse">Carregando...</div>
              </TableCell>
            </TableRow>
          ) : processes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Nenhum processo encontrado
              </TableCell>
            </TableRow>
          ) : (
            processes.map((process) => {
              const clients = getClientNames(process);
              return (
                <TableRow
                  key={process.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/processes/${process.id}`)}
                >
                  <TableCell className="font-mono text-sm">{process.process_number}</TableCell>
                  <TableCell>{process.tribunal || "-"}</TableCell>
                  <TableCell>{process.uf || "-"}</TableCell>
                  <TableCell>{process.instance || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[process.status_code || 0] || ""}>
                      {process.status_description || process.status || "Pendente"}
                    </Badge>
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
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/processes/${process.id}`); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
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
    </div>
  );
}
