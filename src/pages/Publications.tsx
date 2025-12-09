import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, Download, Calendar } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { PublicationsTable } from "@/components/publications/PublicationsTable";
import { PublicationsStats } from "@/components/publications/PublicationsStats";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

const Publications = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      toast.info("Iniciando sincronização de publicações...");
      
      const { data, error } = await supabase.functions.invoke("sync-publications", {
        body: {},
      });

      if (error) throw error;
      
      const totalSynced = data?.results?.reduce((acc: number, r: any) => acc + (r.synced || 0), 0) || 0;
      toast.success(`Sincronização concluída: ${totalSynced} publicações sincronizadas`);
      
      // Refresh the table after sync
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar publicações");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncPeriod = async () => {
    setIsSyncing(true);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, 7);
      
      toast.info("Sincronizando publicações dos últimos 7 dias...");
      
      const { data, error } = await supabase.functions.invoke("sync-publications", {
        body: {
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
        },
      });

      if (error) throw error;
      
      const totalSynced = data?.results?.reduce((acc: number, r: any) => acc + (r.synced || 0), 0) || 0;
      toast.success(`Sincronização concluída: ${totalSynced} publicações dos últimos 7 dias`);
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar publicações");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Publicações" },
        ]}
      />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Publicações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie e consulte todas as publicações sincronizadas dos diários oficiais
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSyncPeriod}
            variant="outline"
            size="sm"
            disabled={isSyncing}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Últimos 7 dias
          </Button>
          <Button
            onClick={handleSync}
            variant="default"
            size="sm"
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Novas'}
          </Button>
        </div>
      </div>

      <PublicationsStats key={`stats-${refreshTrigger}`} />

      <Card>
        <CardHeader>
          <CardTitle>Publicações Recentes</CardTitle>
          <CardDescription>
            Visualize todas as publicações encontradas nos diários oficiais baseadas nos seus termos de busca
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <PublicationsTable key={`table-${refreshTrigger}`} />
        </CardContent>
      </Card>
    </div>
  );
};

export default Publications;
