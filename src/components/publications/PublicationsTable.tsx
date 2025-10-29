import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Search, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PublicationDetailDialog } from "./PublicationDetailDialog";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchPublications();
    
    // Realtime subscription
    const channel = supabase
      .channel('publications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'publications'
        },
        () => fetchPublications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPage, searchTerm, filterGazette, filterPartner]);

  const fetchPublications = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from("publications")
        .select("*, partners(name), partner_services(service_name)", { count: "exact" })
        .order("publication_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      // Apply filters
      if (searchTerm) {
        query = query.or(`content.ilike.%${searchTerm}%,matched_terms.cs.{${searchTerm}}`);
      }

      if (filterGazette !== "all") {
        query = query.eq("gazette_name", filterGazette);
      }

      if (filterPartner !== "all") {
        query = query.eq("partner_id", filterPartner);
      }

      // Pagination
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

  const getContentPreview = (content: string | null) => {
    if (!content) return "Sem conteúdo";
    return content.length > 150 ? `${content.substring(0, 150)}...` : content;
  };

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
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar no conteúdo ou termos..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
        
        <Select value={filterGazette} onValueChange={(value) => {
          setFilterGazette(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por gazeta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Gazetas</SelectItem>
            {Array.from(new Set(publications.map(p => p.gazette_name).filter(Boolean))).map((gazette) => (
              <SelectItem key={gazette} value={gazette!}>
                {gazette}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPartner} onValueChange={(value) => {
          setFilterPartner(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por parceiro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Parceiros</SelectItem>
            {Array.from(new Set(publications.map(p => p.partners?.name).filter(Boolean))).map((partner) => (
              <SelectItem key={partner} value={partner!}>
                {partner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {publications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {term}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                      {publication.matched_terms && publication.matched_terms.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{publication.matched_terms.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <div className="font-medium">{publication.partners?.name || "-"}</div>
                      <div className="text-muted-foreground text-xs">
                        {publication.partner_services?.service_name || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-sm text-muted-foreground truncate">
                      {getContentPreview(publication.content)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPublication(publication)}
                      className="gap-1"
                    >
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
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
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

      {/* Detail Dialog */}
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
