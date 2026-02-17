import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Search, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PublicationDetailDialog } from "./PublicationDetailDialog";
import { DateRangePicker } from "./DateRangePicker";
import { HighlightedContent } from "./HighlightedContent";
import { ConfirmationBadge } from "@/components/shared/ConfirmationBadge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Publication {
  id: string;
  publication_date: string | null;
  gazette_name: string | null;
  content: string | null;
  matched_terms: string[] | null;
  raw_data: any;
  created_at: string;
  partner_id: string | null;
  partners?: { name: string };
  partner_service_id: string | null;
  partner_services?: { service_name: string };
}

export function PublicationsTable() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGazette, setFilterGazette] = useState<string>("all");
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterConfirmation, setFilterConfirmation] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [gazetteOptions, setGazetteOptions] = useState<string[]>([]);
  const [partnerOptions, setPartnerOptions] = useState<{ id: string; name: string }[]>([]);
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 20;

  useEffect(() => {
    fetchPublications();
  }, [currentPage, searchTerm, filterGazette, filterPartner, filterClient, filterConfirmation, dateRange]);

  useEffect(() => {
    fetchFilterOptions();
    
    const channel = supabase
      .channel('publications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publications' }, () => fetchPublications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchFilterOptions = async () => {
    const { data: gazetteData } = await supabase
      .from("publications")
      .select("gazette_name")
      .not("gazette_name", "is", null);
    
    const gazettes = [...new Set(gazetteData?.map(g => g.gazette_name).filter(Boolean))];
    setGazetteOptions(gazettes as string[]);

    const { data: partnerData } = await supabase
      .from("partners")
      .select("id, name")
      .eq("is_active", true);
    setPartnerOptions(partnerData || []);

    const { data: clientData } = await supabase
      .from("client_systems")
      .select("id, name")
      .eq("is_active", true);
    setClientOptions(clientData || []);
  };

  const fetchPublications = async () => {
    try {
      setIsLoading(true);

      // Fetch confirmed IDs for publications
      const { data: confirmations } = await supabase
        .from("record_confirmations")
        .select("record_id")
        .eq("record_type", "publications");
      const confirmedSet = new Set((confirmations || []).map(c => c.record_id));
      setConfirmedIds(confirmedSet);

      // If filtering by client, get client terms first
      let clientTermFilter: string[] | null = null;
      if (filterClient !== "all") {
        const { data: clientTermLinks } = await supabase
          .from("client_search_terms")
          .select("search_term_id")
          .eq("client_system_id", filterClient);
        if (clientTermLinks && clientTermLinks.length > 0) {
          const termIds = clientTermLinks.map(ct => ct.search_term_id);
          const { data: terms } = await supabase
            .from("search_terms")
            .select("term")
            .in("id", termIds);
          clientTermFilter = (terms || []).map(t => t.term);
        } else {
          clientTermFilter = [];
        }
      }

      // If client has no terms, return empty
      if (clientTermFilter !== null && clientTermFilter.length === 0) {
        setPublications([]);
        setTotalCount(0);
        setIsLoading(false);
        return;
      }
      
      let query = supabase
        .from("publications")
        .select("*, partners(name), partner_services(service_name)", { count: "exact" })
        .order("publication_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`content.ilike.%${searchTerm}%,matched_terms.cs.{${searchTerm}}`);
      }
      if (filterGazette !== "all") query = query.eq("gazette_name", filterGazette);
      if (filterPartner !== "all") query = query.eq("partner_id", filterPartner);
      if (clientTermFilter) query = query.overlaps("matched_terms", clientTermFilter);
      if (dateRange.from) query = query.gte("publication_date", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange.to) query = query.lte("publication_date", format(dateRange.to, "yyyy-MM-dd"));

      // Confirmation filter
      if (filterConfirmation === "confirmed") {
        const ids = Array.from(confirmedSet);
        if (ids.length === 0) {
          setPublications([]);
          setTotalCount(0);
          setIsLoading(false);
          return;
        }
        query = query.in("id", ids);
      } else if (filterConfirmation === "not_confirmed") {
        const ids = Array.from(confirmedSet);
        if (ids.length > 0) {
          query = query.not("id", "in", `(${ids.join(",")})`);
        }
      }

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      
      setPublications(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching publications:", error);
      toast.error("Erro ao carregar publicações");
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const hasActiveFilters = searchTerm || filterGazette !== "all" || filterPartner !== "all" || filterClient !== "all" || filterConfirmation !== "all" || dateRange.from;

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Carregando publicações...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="flex-1 relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar no conteúdo ou termos..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onSelect={(range) => { setDateRange(range); setCurrentPage(1); }}
        />

        <Select value={filterGazette} onValueChange={(v) => { setFilterGazette(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Gazeta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Gazetas</SelectItem>
            {gazetteOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterPartner} onValueChange={(v) => { setFilterPartner(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Parceiro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Parceiros</SelectItem>
            {partnerOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterClient} onValueChange={(v) => { setFilterClient(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            {clientOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterConfirmation} onValueChange={(v) => { setFilterConfirmation(v); setCurrentPage(1); }}>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchTerm("");
              setFilterGazette("all");
              setFilterPartner("all");
              setFilterClient("all");
              setFilterConfirmation("all");
              setDateRange({ from: undefined, to: undefined });
              setCurrentPage(1);
            }}
            title="Limpar filtros"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Data
                </div>
              </TableHead>
              <TableHead>Gazeta</TableHead>
              <TableHead>Termos</TableHead>
              <TableHead>Parceiro/Serviço</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead className="w-[80px]">Confirm.</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {publications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma publicação encontrada
                </TableCell>
              </TableRow>
            ) : (
              publications.map((publication) => (
                <TableRow key={publication.id}>
                  <TableCell className="text-sm font-medium">
                    {publication.publication_date
                      ? format(new Date(publication.publication_date), "dd/MM/yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {publication.gazette_name || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {publication.matched_terms && publication.matched_terms.length > 0 ? (
                        publication.matched_terms.slice(0, 3).map((term, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{term}</Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                      {publication.matched_terms && publication.matched_terms.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{publication.matched_terms.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <div className="font-medium">{publication.partners?.name || "-"}</div>
                      <div className="text-muted-foreground text-xs">{publication.partner_services?.service_name || "-"}</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      <HighlightedContent content={publication.content || ""} terms={publication.matched_terms || []} maxLength={150} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <ConfirmationBadge
                      recordId={publication.id}
                      recordType="publications"
                      isConfirmed={confirmedIds.has(publication.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPublication(publication)} className="gap-1">
                      <Eye className="h-4 w-4" />
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
            {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} publicações
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

      {selectedPublication && (
        <PublicationDetailDialog
          publication={selectedPublication}
          open={!!selectedPublication}
          onOpenChange={(open) => !open && setSelectedPublication(null)}
        />
      )}
    </div>
  );
}
