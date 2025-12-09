import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RefreshCw, Trash2, FileText, Users, Scale, Clock, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { supabase } from "@/integrations/supabase/client";
import { ProcessMovementsTab } from "@/components/processes/ProcessMovementsTab";
import { ProcessPartiesTab } from "@/components/processes/ProcessPartiesTab";
import { ProcessDocumentsTab } from "@/components/processes/ProcessDocumentsTab";
import { ProcessCoverTab } from "@/components/processes/ProcessCoverTab";

interface Process {
  id: string;
  process_number: string;
  tribunal: string | null;
  status: string | null;
  status_code: number | null;
  status_description: string | null;
  instance: string | null;
  uf: string | null;
  cod_processo: number | null;
  cod_escritorio: number | null;
  created_at: string | null;
  updated_at: string | null;
  last_sync_at: string | null;
  last_cover_sync_at: string | null;
}

const statusColors: Record<number, string> = {
  2: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  4: "bg-green-500/20 text-green-700 border-green-500/30",
  5: "bg-gray-500/20 text-gray-700 border-gray-500/30",
  6: "bg-red-500/20 text-red-700 border-red-500/30",
  7: "bg-destructive/20 text-destructive border-destructive/30",
};

const ProcessDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchProcess();
  }, [id]);

  const fetchProcess = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("processes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setProcess(data);
    } catch (error) {
      console.error("Error fetching process:", error);
      toast.error("Erro ao carregar processo");
      navigate("/processes");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!process) return;
    
    try {
      setSyncing(true);
      toast.info("Sincronizando dados do processo...");

      // First check status
      await supabase.functions.invoke("sync-process-management", {
        body: { 
          action: "status",
          processNumber: process.process_number,
        },
      });

      // Then sync updates
      await supabase.functions.invoke("sync-process-updates", {
        body: { syncType: "full" },
      });

      await fetchProcess();
      setRefreshTrigger(prev => prev + 1);
      toast.success("Processo sincronizado");
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar processo");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!process || !confirm("Tem certeza que deseja excluir este processo do monitoramento?")) return;

    try {
      const { error } = await supabase.functions.invoke("sync-process-management", {
        body: {
          action: "delete",
          processNumber: process.process_number,
        },
      });

      if (error) throw error;
      
      toast.success("Processo excluído do monitoramento");
      navigate("/processes");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erro ao excluir processo");
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!process) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Processo não encontrado</p>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Processos", href: "/processes" },
          { label: process.process_number },
        ]}
      />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/processes")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              {process.process_number}
            </h1>
            <Badge 
              variant="outline" 
              className={statusColors[process.status_code || 0] || ""}
            >
              {process.status_description || process.status || "Pendente"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground ml-12">
            {process.tribunal && <span>Tribunal: {process.tribunal}</span>}
            {process.uf && <span>UF: {process.uf}</span>}
            {process.instance && <span>Instância: {process.instance}</span>}
          </div>
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
            onClick={handleDelete}
            variant="destructive"
            size="sm"
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Código Solucionare</span>
            </div>
            <p className="text-2xl font-bold mt-1">{process.cod_processo || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Escritório</span>
            </div>
            <p className="text-2xl font-bold mt-1">{process.cod_escritorio || "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Última Sincronização</span>
            </div>
            <p className="text-sm font-medium mt-1">
              {process.last_sync_at 
                ? new Date(process.last_sync_at).toLocaleString("pt-BR")
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Última Capa</span>
            </div>
            <p className="text-sm font-medium mt-1">
              {process.last_cover_sync_at 
                ? new Date(process.last_cover_sync_at).toLocaleString("pt-BR")
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cover" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cover" className="gap-2">
            <FileText className="h-4 w-4" />
            Capa
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <Clock className="h-4 w-4" />
            Andamentos
          </TabsTrigger>
          <TabsTrigger value="parties" className="gap-2">
            <Users className="h-4 w-4" />
            Partes
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cover">
          <ProcessCoverTab processId={process.id} key={`cover-${refreshTrigger}`} />
        </TabsContent>
        
        <TabsContent value="movements">
          <ProcessMovementsTab processId={process.id} key={`mov-${refreshTrigger}`} />
        </TabsContent>
        
        <TabsContent value="parties">
          <ProcessPartiesTab processId={process.id} key={`parties-${refreshTrigger}`} />
        </TabsContent>
        
        <TabsContent value="documents">
          <ProcessDocumentsTab processId={process.id} key={`docs-${refreshTrigger}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProcessDetails;
