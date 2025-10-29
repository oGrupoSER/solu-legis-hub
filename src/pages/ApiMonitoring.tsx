import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";

interface ApiRequest {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  request_time: string;
  client_systems?: { name: string };
}

interface EndpointStats {
  endpoint: string;
  count: number;
  avgResponseTime: number;
}

const ApiMonitoring = () => {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterEndpoint, setFilterEndpoint] = useState<string>("all");
  const [stats, setStats] = useState<EndpointStats[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel('api-requests-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'api_requests'
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch recent requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("api_requests")
        .select("*, client_systems(name)")
        .order("request_time", { ascending: false })
        .limit(100);

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);

      // Calculate endpoint statistics
      if (requestsData) {
        const endpointMap = new Map<string, { count: number; totalTime: number }>();
        
        requestsData.forEach((req) => {
          const key = req.endpoint;
          const current = endpointMap.get(key) || { count: 0, totalTime: 0 };
          endpointMap.set(key, {
            count: current.count + 1,
            totalTime: current.totalTime + (req.response_time_ms || 0),
          });
        });

        const statsArray = Array.from(endpointMap.entries()).map(([endpoint, data]) => ({
          endpoint,
          count: data.count,
          avgResponseTime: Math.round(data.totalTime / data.count),
        }));

        setStats(statsArray.sort((a, b) => b.count - a.count));

        // Generate time series data (last 24 hours)
        const hourlyData = new Map<string, number>();
        const now = new Date();
        
        requestsData.forEach((req) => {
          const reqDate = new Date(req.request_time);
          const hoursDiff = Math.floor((now.getTime() - reqDate.getTime()) / (1000 * 60 * 60));
          
          if (hoursDiff < 24) {
            const hourKey = `${23 - hoursDiff}h`;
            hourlyData.set(hourKey, (hourlyData.get(hourKey) || 0) + 1);
          }
        });

        const timeData = Array.from(hourlyData.entries())
          .map(([hour, count]) => ({ hour, requests: count }))
          .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

        setTimeSeriesData(timeData);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge variant="default">200 OK</Badge>;
    } else if (statusCode >= 400 && statusCode < 500) {
      return <Badge variant="destructive">{statusCode}</Badge>;
    } else if (statusCode >= 500) {
      return <Badge variant="destructive">{statusCode} Error</Badge>;
    }
    return <Badge variant="secondary">{statusCode}</Badge>;
  };

  const totalRequests = requests.length;
  const avgResponseTime = requests.length > 0
    ? Math.round(requests.reduce((sum, req) => sum + (req.response_time_ms || 0), 0) / requests.length)
    : 0;

  const filteredRequests = filterEndpoint === "all"
    ? requests
    : requests.filter((req) => req.endpoint === filterEndpoint);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Monitoramento de API" },
        ]}
      />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monitoramento de API</h1>
          <p className="text-muted-foreground mt-1">Análise de requisições e performance</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Requisições</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests}</div>
            <p className="text-xs text-muted-foreground">Últimas 100 requisições</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <TrendingDown className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">Tempo de resposta médio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Endpoints Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.length}</div>
            <p className="text-xs text-muted-foreground">Endpoints únicos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Requisições nas Últimas 24h</CardTitle>
            <CardDescription>Volume de requisições por hora</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requisições por Endpoint</CardTitle>
            <CardDescription>Top endpoints mais utilizados</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="endpoint" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Requisições Recentes</CardTitle>
              <CardDescription>Últimas 100 requisições à API</CardDescription>
            </div>
            <Select value={filterEndpoint} onValueChange={setFilterEndpoint}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por endpoint" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Endpoints</SelectItem>
                {stats.map((stat) => (
                  <SelectItem key={stat.endpoint} value={stat.endpoint}>
                    {stat.endpoint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma requisição encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-sm">{req.endpoint}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{req.method}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status_code)}</TableCell>
                      <TableCell className="text-sm">{req.client_systems?.name || "-"}</TableCell>
                      <TableCell className="font-medium">{req.response_time_ms}ms</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(req.request_time), "dd/MM/yyyy HH:mm:ss")}
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
};

export default ApiMonitoring;
