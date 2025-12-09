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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Search, AlertTriangle, Info, Building2, Calendar, Loader2, Eye } from "lucide-react";

export default function CourtStatus() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTribunal, setFilterTribunal] = useState<string>("all");
  const [filterAssunto, setFilterAssunto] = useState<string>("all");
  const [selectedNews, setSelectedNews] = useState<any>(null);

  // Fetch court news
  const { data: news, isLoading } = useQuery({
    queryKey: ["court-news", searchTerm, filterTribunal, filterAssunto],
    queryFn: async () => {
      let query = supabase
        .from("court_news")
        .select("*")
        .order("data_publicacao", { ascending: false })
        .limit(200);

      if (searchTerm) {
        query = query.or(`titulo.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%,tribunal.ilike.%${searchTerm}%`);
      }

      if (filterTribunal && filterTribunal !== "all") {
        query = query.eq("tribunal", filterTribunal);
      }

      if (filterAssunto && filterAssunto !== "all") {
        query = query.eq("assunto", filterAssunto);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Get unique tribunals for filter
  const tribunals = [...new Set(news?.map((n) => n.tribunal).filter(Boolean) || [])];
  const assuntos = [...new Set(news?.map((n) => n.assunto).filter(Boolean) || [])];

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-court-news");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["court-news"] });
      const total = data?.results?.reduce((acc: number, r: any) => acc + (r.synced || 0), 0) || 0;
      toast.success(`Sincronização concluída: ${total} notícias sincronizadas`);
    },
    onError: (error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  // Stats
  const todayNews = news?.filter((n) => {
    if (!n.data_publicacao) return false;
    const pubDate = new Date(n.data_publicacao);
    const today = new Date();
    return pubDate.toDateString() === today.toDateString();
  }).length || 0;

  const weekNews = news?.filter((n) => {
    if (!n.data_publicacao) return false;
    const pubDate = new Date(n.data_publicacao);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return pubDate >= weekAgo;
  }).length || 0;

  const getAssuntoBadgeVariant = (assunto: string) => {
    const lower = assunto?.toLowerCase() || "";
    if (lower.includes("suspens") || lower.includes("indisp")) return "destructive";
    if (lower.includes("feriado") || lower.includes("recesso")) return "secondary";
    if (lower.includes("praz") || lower.includes("urgent")) return "default";
    return "outline";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status dos Tribunais</h1>
          <p className="text-muted-foreground">
            Notícias e alertas sobre funcionamento dos tribunais
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
            <CardTitle className="text-sm font-medium">Total de Notícias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{news?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{todayNews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekNews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tribunais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tribunals.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Notícias dos Tribunais</CardTitle>
          <CardDescription>Alertas de suspensões, feriados e funcionamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, descrição ou tribunal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterTribunal} onValueChange={setFilterTribunal}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por tribunal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tribunais</SelectItem>
                {tribunals.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAssunto} onValueChange={setFilterAssunto}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por assunto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os assuntos</SelectItem>
                {assuntos.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : news?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma notícia encontrada</p>
              <p className="text-sm text-muted-foreground">
                Configure um serviço de notícias e sincronize os dados
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tribunal</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead className="max-w-[300px]">Título</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {news?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {item.data_publicacao
                          ? format(new Date(item.data_publicacao), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <Building2 className="mr-1 h-3 w-3" />
                        {item.tribunal || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getAssuntoBadgeVariant(item.assunto)}>
                        {item.assunto?.includes("Suspens") && (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        )}
                        {item.assunto || "Geral"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" title={item.titulo}>
                      {item.titulo || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedNews(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedNews} onOpenChange={() => setSelectedNews(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedNews?.titulo || "Detalhes da Notícia"}</DialogTitle>
            <DialogDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">
                  <Building2 className="mr-1 h-3 w-3" />
                  {selectedNews?.tribunal}
                </Badge>
                {selectedNews?.estado && (
                  <Badge variant="secondary">{selectedNews.estado}</Badge>
                )}
                <Badge variant={getAssuntoBadgeVariant(selectedNews?.assunto)}>
                  {selectedNews?.assunto}
                </Badge>
              </div>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-4 py-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Data de Publicação</h4>
                <p className="text-muted-foreground">
                  {selectedNews?.data_publicacao
                    ? format(new Date(selectedNews.data_publicacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : "-"}
                </p>
              </div>
              {selectedNews?.data_disponibilizacao && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Data de Disponibilização</h4>
                  <p className="text-muted-foreground">
                    {format(new Date(selectedNews.data_disponibilizacao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium mb-1">Descrição</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {selectedNews?.descricao || "Sem descrição disponível."}
                </p>
              </div>
              {selectedNews?.sigla_diario && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Diário</h4>
                  <p className="text-muted-foreground">{selectedNews.sigla_diario}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
