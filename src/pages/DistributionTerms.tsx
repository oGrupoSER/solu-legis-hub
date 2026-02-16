import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, Loader2, Download, RefreshCw } from "lucide-react";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { ClientBadges } from "@/components/shared/ClientBadges";
import { ClientSelector } from "@/components/shared/ClientSelector";

interface DistributionTerm {
  id: string;
  term: string;
  term_type: string;
  is_active: boolean;
  created_at: string;
  solucionare_code: number | null;
  partners?: { name: string };
  partner_services?: { service_name: string };
  client_search_terms?: { client_systems: { id: string; name: string } }[];
}

export default function DistributionTerms() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [newTermDialog, setNewTermDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("");
  const [newTerm, setNewTerm] = useState({ nome: "", instancia: "1", abrangencia: "NACIONAL" });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientError, setClientError] = useState(false);

  // Fetch distribution terms
  const { data: terms = [], isLoading } = useQuery({
    queryKey: ["distribution-terms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("search_terms")
        .select("*, partners(name), partner_services(service_name), client_search_terms(client_systems(id, name))")
        .eq("term_type", "distribution")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DistributionTerm[];
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

  // Register name mutation
  const registerMutation = useMutation({
    mutationFn: async (params: { nome: string; instancia: number; abrangencia: string; clientIds: string[] }) => {
      if (!selectedService) throw new Error("Selecione um serviço");
      if (params.clientIds.length === 0) throw new Error("Selecione ao menos um cliente");
      const { data, error } = await supabase.functions.invoke("manage-distribution-terms", {
        body: { action: "registerName", serviceId: selectedService, ...params },
      });
      if (error) throw error;

      // After registration, link to clients via search_terms
      // Find the search_term that was just created/exists for this name
      const { data: termData } = await supabase
        .from("search_terms")
        .select("id")
        .eq("term", params.nome)
        .eq("term_type", "distribution")
        .eq("partner_service_id", selectedService)
        .maybeSingle();

      if (termData) {
        // Delete existing links and re-insert
        await supabase.from("client_search_terms").delete().eq("search_term_id", termData.id);
        const links = params.clientIds.map((clientId) => ({
          search_term_id: termData.id,
          client_system_id: clientId,
        }));
        await supabase.from("client_search_terms").insert(links);
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Nome cadastrado com sucesso");
      setNewTermDialog(false);
      setNewTerm({ nome: "", instancia: "1", abrangencia: "NACIONAL" });
      setSelectedClients([]);
      setClientError(false);
      queryClient.invalidateQueries({ queryKey: ["distribution-terms"] });
    },
    onError: (error) => toast.error(`Erro ao cadastrar: ${error.message}`),
  });

  // Sync mutation - fetches names from partner and updates local DB
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!services || services.length === 0) throw new Error("Nenhum serviço de distribuições ativo. Cadastre um serviço do tipo 'distributions' em Cadastros > Parceiros > Serviços.");
      const { data, error } = await supabase.functions.invoke("manage-distribution-terms", {
        body: { action: "listNames", serviceId: services[0].id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["distribution-terms"] });
      const count = data?.names?.length || data?.length || 0;
      toast.success(`Sincronização concluída: ${count} nomes encontrados`);
    },
    onError: (error) => toast.error(`Erro ao sincronizar: ${error.message}`),
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, activate }: { id: string; activate: boolean }) => {
      const { error } = await supabase.from("search_terms").update({ is_active: activate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-terms"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("search_terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-terms"] });
      toast.success("Nome removido");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const filteredTerms = terms.filter((t) => {
    const matchesSearch = !searchQuery || t.term.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || (filterStatus === "active" ? t.is_active : !t.is_active);
    return matchesSearch && matchesStatus;
  });

  const getClientNames = (term: DistributionTerm): string[] => {
    return term.client_search_terms?.map((cst: any) => cst.client_systems?.name).filter(Boolean) || [];
  };

  const handleExport = () => {
    const csv = [
      ["Nome", "Parceiro", "Serviço", "Status", "Clientes", "Cadastrado em"],
      ...filteredTerms.map((t) => [
        t.term, t.partners?.name || "-", t.partner_services?.service_name || "-",
        t.is_active ? "Ativo" : "Inativo", getClientNames(t).join("; ") || "-",
        t.created_at ? format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR }) : "-",
      ]),
    ].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nomes-distribuicao-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Exportado com sucesso");
  };

  const activeCount = terms.filter((t) => t.is_active).length;

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Distribuições", href: "/distributions" }, { label: "Nomes Monitorados" }]} />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nomes Monitorados</h1>
          <p className="text-muted-foreground mt-1">Gerencie os nomes monitorados para novas distribuições</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Dialog open={newTermDialog} onOpenChange={setNewTermDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Cadastrar Nome</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Nome para Monitoramento</DialogTitle>
                <DialogDescription>Adicione um nome para monitorar novas distribuições</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Serviço de Distribuições</Label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                    <SelectContent>
                      {services?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome para Monitorar</Label>
                  <Input value={newTerm.nome} onChange={(e) => setNewTerm({ ...newTerm, nome: e.target.value })} placeholder="Ex: João da Silva" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Instância</Label>
                    <Select value={newTerm.instancia} onValueChange={(v) => setNewTerm({ ...newTerm, instancia: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1ª Instância</SelectItem>
                        <SelectItem value="2">2ª Instância</SelectItem>
                        <SelectItem value="3">Tribunais Superiores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Abrangência</Label>
                    <Select value={newTerm.abrangencia} onValueChange={(v) => setNewTerm({ ...newTerm, abrangencia: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NACIONAL">Nacional</SelectItem>
                        <SelectItem value="ESTADUAL">Estadual</SelectItem>
                        <SelectItem value="FEDERAL">Federal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <ClientSelector
                  serviceId={selectedService || undefined}
                  selectedIds={selectedClients}
                  onChange={(ids) => { setSelectedClients(ids); setClientError(false); }}
                  error={clientError}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewTermDialog(false)}>Cancelar</Button>
                <Button onClick={() => {
                  if (!newTerm.nome.trim()) { toast.error("Digite um nome"); return; }
                  if (selectedClients.length === 0) { setClientError(true); toast.error("Selecione ao menos um cliente"); return; }
                  registerMutation.mutate({ nome: newTerm.nome, instancia: parseInt(newTerm.instancia), abrangencia: newTerm.abrangencia, clientIds: selectedClients });
                }} disabled={registerMutation.isPending}>
                  {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Nomes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{terms.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{activeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Inativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-muted-foreground">{terms.length - activeCount}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar nome..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Clientes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredTerms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum nome encontrado</TableCell>
                  </TableRow>
                ) : (
                  filteredTerms.map((term) => {
                    const clients = getClientNames(term);
                    return (
                      <TableRow key={term.id}>
                        <TableCell className="font-medium">{term.term}</TableCell>
                        <TableCell className="text-sm">{term.partners?.name || "-"}</TableCell>
                        <TableCell className="text-sm">{term.partner_services?.service_name || "-"}</TableCell>
                        <TableCell>
                          <ClientBadges clients={clients} />
                        </TableCell>
                        <TableCell>
                          <Badge variant={term.is_active ? "default" : "secondary"}>
                            {term.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {term.created_at ? format(new Date(term.created_at), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate({ id: term.id, activate: !term.is_active })}>
                              {term.is_active ? "Desativar" : "Ativar"}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                              if (confirm("Tem certeza que deseja excluir este nome?")) deleteMutation.mutate(term.id);
                            }}>
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
