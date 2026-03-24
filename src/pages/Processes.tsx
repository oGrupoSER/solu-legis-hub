import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Plus, Gavel, Link2, Download, Search, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { ProcessesTable } from "@/components/processes/ProcessesTable";
import { ProcessDialog } from "@/components/processes/ProcessDialog";
import { ProcessesStats } from "@/components/processes/ProcessesStats";
import { BulkClientLinkDialog } from "@/components/shared/BulkClientLinkDialog";
import { SyncProgressDialog } from "@/components/processes/SyncProgressDialog";
import { supabase } from "@/integrations/supabase/client";

async function fetchAllStatusOptions() {
  const PAGE_SIZE = 1000;
  const map = new Map<string, { code: number | null; description: string }>();
  let from = 0;

  while (true) {
    const { data } = await supabase
      .from("processes")
      .select("status_code, status_description")
      .range(from, from + PAGE_SIZE - 1);

    if (!data || data.length === 0) break;
    data.forEach((p) => {
      const desc = p.status_description || "Sem status";
      if (!map.has(desc)) map.set(desc, { code: p.status_code, description: desc });
    });
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return Array.from(map.values());
}

const Processes = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusOptions, setStatusOptions] = useState<{ code: number | null; description: string }[]>([]);

  useEffect(() => {
    fetchAllStatusOptions().then(setStatusOptions);
  }, [refreshTrigger]);

  const handleProcessCreated = () => {
    setDialogOpen(false);
    setRefreshTrigger(prev => prev + 1);
    toast.success("Processo cadastrado com sucesso");
  };

  const handleStatusClick = (status: string) => {
    setFilterStatus(status);
  };

  const handleExport = async () => {
    try {
      const { data } = await supabase
        .from("processes")
        .select("process_number, cod_escritorio, tribunal, uf, instance, status_description, solucionare_status, last_sync_at")
        .order("process_number");

      const csv = [
        ["Número do Processo", "Escritório", "Tribunal", "UF", "Instância", "Status", "Solucionare", "Última Sincronização"],
        ...(data || []).map((p: any) => [
          p.process_number, p.cod_escritorio || "-", p.tribunal || "-", p.uf || "-",
          p.instance || "-", p.status_description || "-", p.solucionare_status || "-",
          p.last_sync_at ? new Date(p.last_sync_at).toLocaleString("pt-BR") : "-",
        ]),
      ].map((r) => r.join(",")).join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `processos-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      toast.success("Processos exportados com sucesso");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Processos" },
        ]}
      />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="h-8 w-8 text-primary" />
            Processos
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastro e acompanhamento de validação de processos CNJ
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setBulkLinkOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Link2 className="h-4 w-4" />
            Vincular Clientes
          </Button>
          <Button
            onClick={() => setSyncDialogOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button
            onClick={() => setDialogOpen(true)}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo Processo
          </Button>
        </div>
      </div>

      <ProcessesStats
        refreshTrigger={refreshTrigger}
        onStatusClick={handleStatusClick}
        activeStatus={filterStatus}
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número do processo ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.description} value={opt.description}>
                  {opt.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ProcessesTable key={refreshTrigger} searchQuery={searchQuery} filterStatus={filterStatus} />
        </CardContent>
      </Card>

      <ProcessDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onSuccess={handleProcessCreated}
      />

      <BulkClientLinkDialog
        open={bulkLinkOpen}
        onOpenChange={setBulkLinkOpen}
        entityType="processes"
        onSuccess={() => setRefreshTrigger(prev => prev + 1)}
      />

      <SyncProgressDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onComplete={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
};

export default Processes;
