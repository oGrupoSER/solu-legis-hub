import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PartnersTable } from "@/components/partners/PartnersTable";
import { ClientSystemsTable } from "@/components/clients/ClientSystemsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Users, Key, Activity, Building2, FileText } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    processes: 0,
    distributions: 0,
    publications: 0,
    partners: 0,
    clientSystems: 0,
    activeTokens: 0,
  });

  useEffect(() => {
    checkAuth();
    fetchStats();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
      return;
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/auth");
      }
    });
  };

  const fetchStats = async () => {
    try {
      const [
        { count: processesCount },
        { count: distributionsCount },
        { count: publicationsCount },
        { count: partnersCount },
        { count: clientSystemsCount },
        { count: activeTokensCount },
      ] = await Promise.all([
        supabase.from("processes").select("*", { count: "exact", head: true }),
        supabase.from("distributions").select("*", { count: "exact", head: true }),
        supabase.from("publications").select("*", { count: "exact", head: true }),
        supabase.from("partners").select("*", { count: "exact", head: true }),
        supabase.from("client_systems").select("*", { count: "exact", head: true }),
        supabase.from("api_tokens").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      setStats({
        processes: processesCount || 0,
        distributions: distributionsCount || 0,
        publications: publicationsCount || 0,
        partners: partnersCount || 0,
        clientSystems: clientSystemsCount || 0,
        activeTokens: activeTokensCount || 0,
      });
    } catch (error) {
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container py-8 flex items-center justify-center">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            title="Processos Cadastrados"
            value={stats.processes.toLocaleString()}
            icon={FileText}
            description="Total de processos no sistema"
          />
          <StatsCard
            title="Distribuições"
            value={stats.distributions.toLocaleString()}
            icon={Activity}
            description="Novos processos monitorados"
          />
          <StatsCard
            title="Publicações"
            value={stats.publications.toLocaleString()}
            icon={FileText}
            description="Recortes de diários oficiais"
          />
          <StatsCard
            title="Parceiros"
            value={stats.partners}
            icon={Building2}
            description="Integradores de APIs"
          />
          <StatsCard
            title="Sistemas Clientes"
            value={stats.clientSystems}
            icon={Users}
            description="Sistemas consumindo a API"
          />
          <StatsCard
            title="Tokens Ativos"
            value={stats.activeTokens}
            icon={Key}
            description="Tokens de autenticação válidos"
          />
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="partners" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="partners">Parceiros</TabsTrigger>
            <TabsTrigger value="clients">Sistemas Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="partners" className="space-y-4">
            <PartnersTable />
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            <ClientSystemsTable />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
