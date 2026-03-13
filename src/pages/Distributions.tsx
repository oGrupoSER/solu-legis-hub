import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, Search, FileText, Building2, Loader2, X } from "lucide-react";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { DateRangePicker } from "@/components/publications/DateRangePicker";
import { ConfirmationBadge } from "@/components/shared/ConfirmationBadge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function Distributions() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterConfirmation, setFilterConfirmation] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterClient, filterConfirmation, dateRange]);

  // Fetch confirmed IDs
  useEffect(() => {
    const fetchConfirmed = async () => {
      const { data } = await supabase
        .from("record_confirmations")
        .select("record_id")
        .eq("record_type", "distributions");
      setConfirmedIds(new Set((data || []).map(c => c.record_id)));
    };
    fetchConfirmed();
  }, []);

  const { data: clients } = useQuery({
    queryKey: ["clients-filter"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_systems").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: distributions, isLoading } = useQuery({
    queryKey: ["distributions", searchTerm, filterClient, filterConfirmation, dateRange],
    queryFn: async () => {
      // Client term filter
      let clientTermFilter: string[] | null = null;
      if (filterClient !== "all") {
        const { data: links } = await supabase.from("client_search_terms").select("search_term_id").eq("client_system_id", filterClient);
        if (links && links.length > 0) {
          const { data: terms } = await supabase.from("search_terms").select("term").in("id", links.map(l => l.search_term_id));
          clientTermFilter = (terms || []).map(t => t.term);
        } else {
          clientTermFilter = [];
        }
      }
      if (clientTermFilter !== null && clientTermFilter.length === 0) return [];

      let query = supabase
        .from("distributions")
        .select("*, partner_services(service_name), partners(name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (searchTerm) query = query.or(`process_number.ilike.%${searchTerm}%,term.ilike.%${searchTerm}%`);
      if (clientTermFilter) query = query.in("term", clientTermFilter);
      if (dateRange.from) query = query.gte("distribution_date", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange.to) query = query.lte("distribution_date", format(dateRange.to, "yyyy-MM-dd"));

      // Confirmation filter
      if (filterConfirmation === "confirmed") {
        const ids = Array.from(confirmedIds);
        if (ids.length === 0) return [];
        query = query.in("id", ids);
      } else if (filterConfirmation === "not_confirmed" && confirmedIds.size > 0) {
        query = query.not("id", "in", `(${Array.from(confirmedIds).join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["distribution-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partner_services").select("id, service_name").eq("service_type", "distributions").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

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
    onError: (error) => toast.error(`Erro na sincronização: ${error.message}`),
  });

  const hasActiveFilters = searchTerm || filterClient !== "all" || filterConfirmation !== "all" || dateRange.from;

  const totalItems = distributions?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedDistributions = distributions?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) || [];

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Dashboard", href: "/" }, { label: "Distribuições" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Distribuições</h1>
          <p className="text-muted-foreground">Novas distribuições de processos recebidas via sincronização</p>
        </div>
        <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          {syncMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sincronizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total de Distribuições</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalItems}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Serviços Ativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{services?.length || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Última Sincronização</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {distributions?.[0]?.created_at ? format(new Date(distributions[0].created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Nunca"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuições Recebidas</CardTitle>
          <CardDescription>Lista de novas distribuições de processos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por número do processo ou termo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>

            <DateRangePicker
              from={dateRange.from}
              to={dateRange.to}
              onSelect={(range) => setDateRange(range)}
            />

            <Select value={filterPartner} onValueChange={setFilterPartner}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Parceiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Parceiros</SelectItem>
                {partners?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clientes</SelectItem>
                {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterConfirmation} onValueChange={setFilterConfirmation}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Confirmação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmed">Confirmados</SelectItem>
                <SelectItem value="not_confirmed">Não confirmados</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={() => {
                setSearchTerm("");
                setFilterClient("all");
                setFilterConfirmation("all");
                setDateRange({ from: undefined, to: undefined });
              }} title="Limpar filtros">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : totalItems === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhuma distribuição encontrada</p>
              <p className="text-sm text-muted-foreground">Cadastre nomes em "Nomes Monitorados" ou sincronize os dados</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número do Processo</TableHead>
                    <TableHead>Tribunal</TableHead>
                    <TableHead>Termo Monitorado</TableHead>
                    <TableHead>Data Distribuição</TableHead>
                    <TableHead>Recebido em</TableHead>
                    <TableHead className="w-[80px]">Confirm.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDistributions.map((dist) => (
                    <TableRow key={dist.id}>
                      <TableCell className="font-mono text-sm">{dist.process_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline"><Building2 className="mr-1 h-3 w-3" />{dist.tribunal || "N/A"}</Badge>
                      </TableCell>
                      <TableCell>{dist.term || "-"}</TableCell>
                      <TableCell>
                        {dist.distribution_date ? format(new Date(dist.distribution_date), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dist.created_at ? format(new Date(dist.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell>
                        <ConfirmationBadge
                          recordId={dist.id}
                          recordType="distributions"
                          isConfirmed={confirmedIds.has(dist.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                    {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} distribuições
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink onClick={() => setCurrentPage(pageNum)} isActive={currentPage === pageNum} className="cursor-pointer">
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
