import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Gavel } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { ProcessesTable } from "@/components/processes/ProcessesTable";
import { ProcessDialog } from "@/components/processes/ProcessDialog";
import { supabase } from "@/integrations/supabase/client";

const Processes = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

      <Card>
        <CardHeader>
          <CardTitle>Processos Monitorados</CardTitle>
          <CardDescription>
            Lista de todos os processos cadastrados para monitoramento
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ProcessesTable key={refreshTrigger} />
        </CardContent>
      </Card>

      <ProcessDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onSuccess={handleProcessCreated}
      />
    </div>
  );
};

export default Processes;
