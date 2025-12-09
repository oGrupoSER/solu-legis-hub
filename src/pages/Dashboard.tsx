import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Key, Activity, Building2, FileText, Clock, Newspaper, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const Dashboard = () => {
  const [stats, setStats] = useState({
    processes: 0,
    distributions: 0,
    publications: 0,
    partners: 0,
    clientSystems: 0,
    activeTokens: 0,
  });
  const [syncData, setSyncData] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchSyncData();
  }, []);

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
    }
  };

  const fetchSyncData = async () => {
    try {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("started_at, records_synced, status")
        .order("started_at", { ascending: true })
        .limit(30);

      if (error) throw error;

      // Group by day
      const grouped = (data || []).reduce((acc: any[], log) => {
        const date = new Date(log.started_at).toLocaleDateString("pt-BR");
        const existing = acc.find((item) => item.date === date);
        
        if (existing) {
          existing.records += log.records_synced || 0;
          existing.syncs += 1;
        } else {
          acc.push({
            date,
            records: log.records_synced || 0,
            syncs: 1,
          });
        }
        
        return acc;
      }, []);

      setSyncData(grouped.slice(-7)); // Last 7 days
    } catch (error) {
      console.error("Error fetching sync data:", error);
    }
  };

  return (
    <div className="container py-8 space-y-8">
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

      {/* Sync Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sincronizações nos Últimos 7 Dias
          </CardTitle>
          <CardDescription>Volume de registros sincronizados por dia</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={syncData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="records" stroke="hsl(var(--primary))" strokeWidth={2} name="Registros" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

    </div>
  );
};

export default Dashboard;
