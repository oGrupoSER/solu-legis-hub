import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  RefreshCw, Search, CheckCircle2, XCircle, Clock, 
  Building2, Calendar, Loader2, History, TrendingUp
} from "lucide-react";

interface DiaryStatus {
  id: string;
  partner_service_id: string;
  consulta_date: string;
  cod_mapa_diario: number;
  nome_diario: string;
  sigla_diario: string;
  esfera_diario: string;
  tribunal: string;
  estado: string;
  data_publicacao: string;
  data_disponibilizacao: string;
  status: string;
  raw_data: any;
  created_at: string;
}

export default function CourtStatus() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTribunal, setSelectedTribunal] = useState<string | null>(null);

  // Fetch today's diary status (latest for each tribunal)
  const { data: diaryStatus, isLoading } = useQuery({
    queryKey: ["diary-status", searchTerm, filterEstado, filterStatus],
    queryFn: async () => {
      // Get today's date
      const today = format(new Date(), "yyyy-MM-dd");
      
      let query = supabase
        .from("diary_status")
        .select("*")
        .eq("consulta_date", today)
        .order("tribunal", { ascending: true });

      if (searchTerm) {
        query = query.or(`tribunal.ilike.%${searchTerm}%,sigla_diario.ilike.%${searchTerm}%,nome_diario.ilike.%${searchTerm}%`);
      }

      if (filterEstado && filterEstado !== "all") {
        query = query.eq("estado", filterEstado);
      }

      if (filterStatus && filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DiaryStatus[];
    },
  });

  // Fetch history for selected tribunal
  const { data: tribunalHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["diary-history", selectedTribunal],
    queryFn: async () => {
      if (!selectedTribunal) return [];
      
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("diary_status")
        .select("*")
        .eq("sigla_diario", selectedTribunal)
        .gte("consulta_date", thirtyDaysAgo)
        .order("consulta_date", { ascending: false });

      if (error) throw error;
      return data as DiaryStatus[];
    },
    enabled: !!selectedTribunal,
  });

  // Get unique states for filter
  const estados = [...new Set(diaryStatus?.map((d) => d.estado).filter(Boolean) || [])].sort();

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-diary-status");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["diary-status"] });
      const total = data?.results?.reduce((acc: number, r: any) => acc + (r.synced || 0), 0) || 0;
      toast.success(`Sincronização concluída: ${total} registros sincronizados`);
    },
    onError: (error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  // Stats
  const totalDiarios = diaryStatus?.length || 0;
  const disponiveisCount = diaryStatus?.filter((d) => d.status === "disponivel").length || 0;
  const indisponiveisCount = diaryStatus?.filter((d) => d.status === "indisponivel").length || 0;
  const pendentesCount = diaryStatus?.filter((d) => d.status === "pendente" || !d.status).length || 0;

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "disponivel":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Disponível
          </Badge>
        );
      case "indisponivel":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Indisponível
          </Badge>
        );
      case "pendente":
      default:
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pendente
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status dos Tribunais</h1>
          <p className="text-muted-foreground">
            Disponibilidade dos diários oficiais por tribunal
          </p>
        </div>
        <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          {syncMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sincronizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Diários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDiarios}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-green-600">{disponiveisCount}</div>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Indisponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-destructive">{indisponiveisCount}</div>
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-muted-foreground">{pendentesCount}</div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Status Atual dos Diários</CardTitle>
          <CardDescription>
            Data de consulta: {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por tribunal, sigla ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por UF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {estados.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="indisponivel">Indisponível</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : diaryStatus?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum status encontrado</p>
              <p className="text-sm text-muted-foreground">
                Configure um serviço de "Status dos Diários" e sincronize
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tribunal</TableHead>
                  <TableHead>Sigla</TableHead>
                  <TableHead>Esfera</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Última Publicação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Histórico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diaryStatus?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.nome_diario || item.tribunal || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.sigla_diario || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.esfera_diario || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.estado || "-"}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {item.data_publicacao
                          ? format(new Date(item.data_publicacao), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTribunal(item.sigla_diario)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={!!selectedTribunal} onOpenChange={() => setSelectedTribunal(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Histórico - {selectedTribunal}
            </DialogTitle>
            <DialogDescription>
              Últimos 30 dias de disponibilidade
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {tribunalHistory?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum histórico encontrado
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Consulta</TableHead>
                        <TableHead>Data Publicação</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tribunalHistory?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {format(new Date(item.consulta_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {item.data_publicacao
                              ? format(new Date(item.data_publicacao), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
