import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { PublicationsTable } from "@/components/publications/PublicationsTable";
import { supabase } from "@/integrations/supabase/client";

const Publications = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSync = async () => {
    try {
      toast.info("Iniciando sincronização de publicações...");
      
      const { data, error } = await supabase.functions.invoke("sync-orchestrator", {
        body: { 
          mode: "parallel",
          services: ["publications"]
        },
      });

      if (error) throw error;
      
      toast.success("Sincronização de publicações iniciada com sucesso");
      
      // Refresh the table after a short delay
      setTimeout(() => setRefreshTrigger(prev => prev + 1), 2000);
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erro ao iniciar sincronização de publicações");
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
        <Button
          onClick={handleSync}
          variant="default"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Sincronizar Publicações
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publicações Recentes</CardTitle>
          <CardDescription>
            Visualize todas as publicações encontradas nos diários oficiais baseadas nos seus termos de busca
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <PublicationsTable key={refreshTrigger} />
        </CardContent>
      </Card>
    </div>
  );
};

export default Publications;
