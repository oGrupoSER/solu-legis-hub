import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Search, Plus, FileText, Building2, Loader2 } from "lucide-react";

export default function Distributions() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [newTermDialog, setNewTermDialog] = useState(false);
  const [newTerm, setNewTerm] = useState({ nome: "", instancia: "1", abrangencia: "NACIONAL" });

  // Fetch distributions
  const { data: distributions, isLoading } = useQuery({
    queryKey: ["distributions", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("distributions")
        .select("*, partner_services(service_name)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchTerm) {
        query = query.or(`process_number.ilike.%${searchTerm}%,term.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch distribution services
  const { data: services } = useQuery({
    queryKey: ["distribution-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_services")
        .select("id, service_name")
        .eq("service_type", "distributions")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Sync distributions mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-distributions");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
      toast.success(`Sincronização concluída: ${data?.results?.length || 0} serviços processados`);
    },
    onError: (error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  // Register name mutation
  const registerNameMutation = useMutation({
    mutationFn: async (params: { nome: string; instancia: number; abrangencia: string }) => {
      if (!selectedService) throw new Error("Selecione um serviço");
      const { data, error } = await supabase.functions.invoke("manage-distribution-terms", {
        body: {
          action: "registerName",
          serviceId: selectedService,
          ...params,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Nome cadastrado com sucesso");
      setNewTermDialog(false);
      setNewTerm({ nome: "", instancia: "1", abrangencia: "NACIONAL" });
      queryClient.invalidateQueries({ queryKey: ["distributions"] });
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar: ${error.message}`);
    },
  });

  const handleRegisterTerm = () => {
    if (!newTerm.nome.trim()) {
      toast.error("Digite um nome para monitorar");
      return;
    }
    registerNameMutation.mutate({
      nome: newTerm.nome,
      instancia: parseInt(newTerm.instancia),
      abrangencia: newTerm.abrangencia,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Distribuições</h1>
            <p className="text-muted-foreground">
              Novas distribuições de processos recebidas
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={newTermDialog} onOpenChange={setNewTermDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Nome
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Nome para Monitoramento</DialogTitle>
                  <DialogDescription>
                    Adicione um nome para monitorar novas distribuições
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Serviço de Distribuições</Label>
                    <Select value={selectedService} onValueChange={setSelectedService}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.service_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome para Monitorar</Label>
                    <Input
                      value={newTerm.nome}
                      onChange={(e) => setNewTerm({ ...newTerm, nome: e.target.value })}
                      placeholder="Ex: João da Silva"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Instância</Label>
                      <Select
                        value={newTerm.instancia}
                        onValueChange={(v) => setNewTerm({ ...newTerm, instancia: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1ª Instância</SelectItem>
                          <SelectItem value="2">2ª Instância</SelectItem>
                          <SelectItem value="3">Tribunais Superiores</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Abrangência</Label>
                      <Select
                        value={newTerm.abrangencia}
                        onValueChange={(v) => setNewTerm({ ...newTerm, abrangencia: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NACIONAL">Nacional</SelectItem>
                          <SelectItem value="ESTADUAL">Estadual</SelectItem>
                          <SelectItem value="FEDERAL">Federal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewTermDialog(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRegisterTerm}
                    disabled={registerNameMutation.isPending}
                  >
                    {registerNameMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Cadastrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              {syncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sincronizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Distribuições</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{distributions?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Serviços Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{services?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Última Sincronização</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {distributions?.[0]?.created_at
                  ? format(new Date(distributions[0].created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "Nunca"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuições Recebidas</CardTitle>
            <CardDescription>Lista de novas distribuições de processos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número do processo ou termo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : distributions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma distribuição encontrada</p>
                <p className="text-sm text-muted-foreground">
                  Cadastre nomes para monitorar ou sincronize os dados
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número do Processo</TableHead>
                    <TableHead>Tribunal</TableHead>
                    <TableHead>Termo Monitorado</TableHead>
                    <TableHead>Data Distribuição</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Recebido em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distributions?.map((dist) => (
                    <TableRow key={dist.id}>
                      <TableCell className="font-mono text-sm">
                        {dist.process_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <Building2 className="mr-1 h-3 w-3" />
                          {dist.tribunal || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>{dist.term || "-"}</TableCell>
                      <TableCell>
                        {dist.distribution_date
                          ? format(new Date(dist.distribution_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(dist.partner_services as any)?.service_name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dist.created_at
                          ? format(new Date(dist.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
