import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Loader2, Download, FileText, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { useNavigate } from "react-router-dom";

interface Movement {
  id: string;
  process_id: string | null;
  description: string | null;
  movement_type: string | null;
  tipo_andamento: string | null;
  movement_date: string | null;
  data_andamento: string | null;
  cod_andamento: number | null;
  created_at: string | null;
  processes?: { process_number: string; tribunal: string | null } | null;
  document_count?: number;
}

export default function ProcessMovements() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["process-movements", searchQuery, sortOrder],
    queryFn: async () => {
      let query = supabase
        .from("process_movements")
        .select("*, processes(process_number, tribunal)")
        .order("data_andamento", { ascending: sortOrder === "asc", nullsFirst: false })
        .limit(200);

      if (searchQuery) {
        query = query.or(`description.ilike.%${searchQuery}%,tipo_andamento.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Movement[];
    },
  });

  // Get document counts
  const { data: docCounts = {} } = useQuery({
    queryKey: ["movement-doc-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_documents")
        .select("movement_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((d) => {
        if (d.movement_id) counts[d.movement_id] = (counts[d.movement_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Get unique movement types for filter
  const movementTypes = [...new Set(movements.map((m) => m.tipo_andamento).filter(Boolean))].sort();

  const filteredMovements = movements.filter((m) => {
    if (filterType !== "all" && m.tipo_andamento !== filterType) return false;
    return true;
  });

  const handleExport = () => {
    const csv = [
      ["Processo", "Tribunal", "Tipo", "Descrição", "Data", "Documentos"],
      ...filteredMovements.map((m) => [
        (m.processes as any)?.process_number || "-",
        (m.processes as any)?.tribunal || "-",
        m.tipo_andamento || m.movement_type || "-",
        (m.description || "").replace(/,/g, ";").substring(0, 100),
        m.data_andamento ? format(new Date(m.data_andamento), "dd/MM/yyyy", { locale: ptBR }) : "-",
        docCounts[m.id] || 0,
      ]),
    ].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `andamentos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Exportado com sucesso");
  };

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Processos", href: "/processes" }, { label: "Andamentos" }]} />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Andamentos</h1>
          <p className="text-muted-foreground mt-1">Movimentações processuais recebidas via sincronização</p>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Andamentos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{movements.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Tipos Distintos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{movementTypes.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Com Documentos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{movements.filter((m) => docCounts[m.id]).length}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição ou tipo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tipo de Andamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {movementTypes.map((t) => (
                <SelectItem key={t} value={t!}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setSortOrder((s) => s === "desc" ? "asc" : "desc")}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Tribunal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="max-w-[300px]">Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Docs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                      Nenhum andamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((mov) => (
                    <TableRow key={mov.id} className="cursor-pointer hover:bg-muted/50" onClick={() => mov.process_id && navigate(`/processes/${mov.process_id}`)}>
                      <TableCell className="font-mono text-sm">
                        {(mov.processes as any)?.process_number || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{(mov.processes as any)?.tribunal || "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{mov.tipo_andamento || mov.movement_type || "-"}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">
                        {mov.description || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {mov.data_andamento
                          ? format(new Date(mov.data_andamento), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {docCounts[mov.id] ? (
                          <Badge variant="outline" className="gap-1">
                            <FileText className="h-3 w-3" /> {docCounts[mov.id]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
