import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SearchTermDialog } from "@/components/terms/SearchTermDialog";
import { TermsStats } from "@/components/terms/TermsStats";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";

interface SearchTerm {
  id: string;
  term: string;
  term_type: string;
  partner_id: string | null;
  partner_service_id: string | null;
  is_active: boolean;
  created_at: string;
  partners?: { name: string };
  partner_services?: { service_name: string };
}

const SearchTerms = () => {
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
        .select("*, partners(name), partner_services(service_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTerms(data || []);
    } catch (error) {
      toast.error("Erro ao carregar termos de busca");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...terms];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((term) =>
        term.term.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((term) => term.term_type === filterType);
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((term) => 
        filterStatus === "active" ? term.is_active : !term.is_active
      );
    }

    setFilteredTerms(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este termo?")) return;

    try {
      const { error } = await supabase.from("search_terms").delete().eq("id", id);
      if (error) throw error;
      toast.success("Termo excluído com sucesso");
      fetchTerms();
    } catch (error) {
      toast.error("Erro ao excluir termo");
    }
  };

  const handleEdit = (term: SearchTerm) => {
    setEditingTerm(term);
    setDialogOpen(true);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStats(null);
    
    try {
      // Get the first terms service (SOAP)
      const { data: services } = await supabase
        .from('partner_services')
        .select('id')
        .eq('service_type', 'terms')
        .eq('is_active', true)
        .limit(1);

      if (!services || services.length === 0) {
        toast.error("Nenhum serviço de termos ativo encontrado. Configure um serviço do tipo 'Termos e Escritórios' primeiro.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('sync-search-terms', {
        body: { serviceId: services[0].id }
      });

      if (error) throw error;

      setSyncStats(data);
      
      const totalImported = data.officesImported + data.namesImported;
      const totalUpdated = data.officesUpdated + data.namesUpdated;
      
      if (data.errors && data.errors.length > 0) {
        toast.warning(`Sincronização concluída com avisos: ${totalImported} importados, ${totalUpdated} atualizados, ${data.errors.length} erros`);
      } else {
        toast.success(`Sincronização concluída: ${totalImported} novos termos, ${totalUpdated} atualizados`);
      }
      
      fetchTerms();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || "Erro ao sincronizar com Solucionare");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Termo", "Tipo", "Parceiro", "Serviço", "Status"],
      ...filteredTerms.map((t) => [
        t.term,
        t.term_type,
        t.partners?.name || "-",
        t.partner_services?.service_name || "-",
        t.is_active ? "Ativo" : "Inativo",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termos-busca-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Termos exportados com sucesso");
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      office: "Escritório",
      name: "Nome de Pesquisa",
      processes: "Processos",
      distributions: "Distribuições",
      publications: "Publicações",
    };
    return types[type] || type;
  };

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
          { label: "Termos de Busca" },
        ]}
      />
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Termos de Busca</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os termos utilizados nas buscas e sincronizações
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Termo
          </Button>
        </div>
      </div>

      <TermsStats />

      {syncStats && (
        <Card>
          <CardHeader>
            <CardTitle>Última Sincronização</CardTitle>
            <CardDescription>Estatísticas da sincronização com Solucionare</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Escritórios Importados</div>
                <div className="text-2xl font-bold">{syncStats.officesImported}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Nomes Importados</div>
                <div className="text-2xl font-bold">{syncStats.namesImported}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Escritórios Atualizados</div>
                <div className="text-2xl font-bold">{syncStats.officesUpdated}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Nomes Atualizados</div>
                <div className="text-2xl font-bold">{syncStats.namesUpdated}</div>
              </div>
            </div>
            {syncStats.errors && syncStats.errors.length > 0 && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                <div className="text-sm font-medium text-destructive mb-1">
                  {syncStats.errors.length} erro(s) durante a sincronização:
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {syncStats.errors.slice(0, 3).map((err: string, idx: number) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {syncStats.errors.length > 3 && (
                    <li>... e mais {syncStats.errors.length - 3} erro(s)</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre os termos por tipo, status ou busca</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar termo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="office">Escritório</SelectItem>
              <SelectItem value="name">Nome de Pesquisa</SelectItem>
              <SelectItem value="processes">Processos</SelectItem>
              <SelectItem value="distributions">Distribuições</SelectItem>
              <SelectItem value="publications">Publicações</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTerms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum termo encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTerms.map((term) => (
                    <TableRow key={term.id}>
                      <TableCell className="font-medium">{term.term}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(term.term_type)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{term.partners?.name || "-"}</TableCell>
                      <TableCell className="text-sm">
                        {term.partner_services?.service_name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={term.is_active ? "default" : "secondary"}>
                          {term.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(term)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(term.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
          if (!open) {
            setEditingTerm(null);
            fetchTerms();
          }
        }}
        term={editingTerm}
      />
    </div>
  );
};

export default SearchTerms;
