import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Plus, Gavel, Link2, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { ProcessesTable } from "@/components/processes/ProcessesTable";
import { ProcessDialog } from "@/components/processes/ProcessDialog";
import { ProcessesStats } from "@/components/processes/ProcessesStats";
import { BulkClientLinkDialog } from "@/components/shared/BulkClientLinkDialog";
import { supabase } from "@/integrations/supabase/client";

const Processes = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const handleSync = async () => {
    try {
      setSyncing(true);
      
      // Step 1: Send pending processes to Solucionare
      toast.info("Enviando processos pendentes e sincronizando...");
      const { data: sendData } = await supabase.functions.invoke("sync-process-management", {
        body: { action: "send-pending" },
      });
      const sent = sendData?.sent || 0;

      // Step 2: Fetch/update from Solucionare
      const { data, error } = await supabase.functions.invoke("sync-process-management", {
        body: { action: "sync" },
      });

      if (error) throw error;
      
      const synced = data?.synced || 0;
      const parts = [];
      if (sent > 0) parts.push(`${sent} enviados`);
      if (synced > 0) parts.push(`${synced} atualizados`);
      toast.success(`Sincronização concluída${parts.length > 0 ? ': ' + parts.join(', ') : ''}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar processos");
    } finally {
      setSyncing(false);
    }
  };

  const handleProcessCreated = () => {
    setDialogOpen(false);
    setRefreshTrigger(prev => prev + 1);
    toast.success("Processo cadastrado com sucesso");
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
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button
            onClick={handleSync}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
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

      <ProcessesStats refreshTrigger={refreshTrigger} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou tribunal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="registered">Cadastrado</SelectItem>
              <SelectItem value="error">Erro na Validação</SelectItem>
              <SelectItem value="archived">Arquivado</SelectItem>
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
    </div>
  );
};

export default Processes;
