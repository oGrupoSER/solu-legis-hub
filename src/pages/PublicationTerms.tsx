import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, Download, RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { SearchTermDialog } from "@/components/terms/SearchTermDialog";
import { TermActionsDropdown } from "@/components/terms/TermActionsDropdown";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { ClientBadges } from "@/components/shared/ClientBadges";

interface SearchTerm {
  id: string;
  term: string;
  term_type: string;
  partner_id: string | null;
  partner_service_id: string | null;
  is_active: boolean;
  created_at: string;
  solucionare_code: number | null;
  solucionare_status: string;
  partners?: { name: string };
  partner_services?: { service_name: string };
  client_search_terms?: { client_systems: { id: string; name: string } }[];
}

const PublicationTerms = () => {
  const [terms, setTerms] = useState<SearchTerm[]>([]);
  const [filteredTerms, setFilteredTerms] = useState<SearchTerm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<SearchTerm | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<any>(null);

  useEffect(() => {
    fetchTerms();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [terms, searchQuery, filterType, filterStatus]);

  const fetchTerms = async () => {
    try {
      const { data, error } = await supabase
        .from("search_terms")
        .select("*, partners(name), partner_services(service_name), client_search_terms(client_systems(id, name))")
        .in("term_type", ["name", "office"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTerms((data as any) || []);
    } catch (error) {
      toast.error("Erro ao carregar termos de publicação");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...terms];
    if (searchQuery) {
      filtered = filtered.filter((t) => t.term.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.term_type === filterType);
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter((t) => filterStatus === "active" ? t.is_active : !t.is_active);
    }
    setFilteredTerms(filtered);
  };

  const handleEdit = (term: SearchTerm) => {
    setEditingTerm(term);
    setDialogOpen(true);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStats(null);
    try {
      const { data: services } = await supabase
        .from("partner_services").select("id")
        .eq("service_type", "terms").eq("is_active", true).limit(1);

      if (!services || services.length === 0) {
        toast.error("Nenhum serviço de termos ativo encontrado.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("sync-search-terms", {
        body: { serviceId: services[0].id },
      });
      if (error) throw error;

      setSyncStats(data);
      const totalImported = data.officesImported + data.namesImported;
      const totalUpdated = data.officesUpdated + data.namesUpdated;

      if (data.errors?.length > 0) {
        toast.warning(`Sincronização com avisos: ${totalImported} importados, ${totalUpdated} atualizados`);
      } else {
        toast.success(`Sincronização concluída: ${totalImported} novos, ${totalUpdated} atualizados`);
      }
      fetchTerms();
    } catch (error: any) {
      toast.error(error.message || "Erro ao sincronizar");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Termo", "Tipo", "Parceiro", "Serviço", "Status", "Clientes"],
      ...filteredTerms.map((t) => [
        t.term,
        t.term_type === "office" ? "Escritório" : "Nome",
        t.partners?.name || "-",
        t.partner_services?.service_name || "-",
        t.is_active ? "Ativo" : "Inativo",
        getClientNames(t).join("; ") || "-",
      ]),
    ].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termos-publicacao-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Termos exportados com sucesso");
  };

  const getClientNames = (term: SearchTerm): string[] => {
    return term.client_search_terms
      ?.map((cst: any) => cst.client_systems?.name)
      .filter(Boolean) || [];
  };

  const activeCount = terms.filter((t) => t.is_active).length;
  const officeCount = terms.filter((t) => t.term_type === "office").length;
  const nameCount = terms.filter((t) => t.term_type === "name").length;

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Publicações", href: "/publications" }, { label: "Termos" }]} />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Termos de Publicação</h1>
          <p className="text-muted-foreground mt-1">Gerencie os termos monitorados nos diários oficiais</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={isSyncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Termo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Termos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{terms.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{activeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Escritórios</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{officeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Nomes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{nameCount}</div></CardContent>
        </Card>
      </div>

      {syncStats && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Última Sincronização</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Escritórios Importados:</span> <strong>{syncStats.officesImported}</strong></div>
              <div><span className="text-muted-foreground">Nomes Importados:</span> <strong>{syncStats.namesImported}</strong></div>
              <div><span className="text-muted-foreground">Escritórios Atualizados:</span> <strong>{syncStats.officesUpdated}</strong></div>
              <div><span className="text-muted-foreground">Nomes Atualizados:</span> <strong>{syncStats.namesUpdated}</strong></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar termo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="office">Escritório</SelectItem>
              <SelectItem value="name">Nome de Pesquisa</SelectItem>
            </SelectContent>
          </Select>
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
                   <TableHead>Termo</TableHead>
                   <TableHead>Tipo</TableHead>
                   <TableHead>Parceiro</TableHead>
                   <TableHead>Serviço</TableHead>
                   <TableHead>Clientes</TableHead>
                   <TableHead>Solucionare</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTerms.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum termo encontrado</TableCell>
                   </TableRow>
                ) : (
                  filteredTerms.map((term) => {
                    const clients = getClientNames(term);
                    return (
                      <TableRow key={term.id}>
                        <TableCell className="font-medium">{term.term}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{term.term_type === "office" ? "Escritório" : "Nome"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{term.partners?.name || "-"}</TableCell>
                        <TableCell className="text-sm">{term.partner_services?.service_name || "-"}</TableCell>
                         <TableCell>
                           <ClientBadges clients={clients} />
                         </TableCell>
                         <TableCell>
                           {term.solucionare_status === 'synced' ? (
                             <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 gap-1">
                               <CheckCircle2 className="h-3 w-3" /> Sincronizado
                             </Badge>
                           ) : term.solucionare_status === 'error' ? (
                             <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
                               <AlertCircle className="h-3 w-3" /> Erro
                             </Badge>
                           ) : (
                             <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 gap-1">
                               <Clock className="h-3 w-3" /> Pendente
                             </Badge>
                           )}
                         </TableCell>
                         <TableCell>
                           <Badge variant={term.is_active ? "default" : "secondary"}>
                             {term.is_active ? "Ativo" : "Inativo"}
                           </Badge>
                         </TableCell>
                        <TableCell className="text-right">
                          <TermActionsDropdown term={term} onEdit={() => handleEdit(term)} onRefresh={fetchTerms} />
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

      <SearchTermDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) { setEditingTerm(null); fetchTerms(); }
        }}
        term={editingTerm}
      />
    </div>
  );
};

export default PublicationTerms;
