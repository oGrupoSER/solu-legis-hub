import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, FileText, ExternalLink, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Movement {
  id: string;
  cod_andamento: number | null;
  movement_type: string | null;
  tipo_andamento: string | null;
  description: string | null;
  movement_date: string | null;
  data_andamento: string | null;
  created_at: string | null;
}

interface Document {
  id: string;
  cod_documento: number;
  cod_andamento: number | null;
  nome_arquivo: string | null;
  tipo_documento: string | null;
  documento_url: string | null;
  storage_path: string | null;
}

interface ProcessMovementsTabProps {
  processId: string;
}

export function ProcessMovementsTab({ processId }: ProcessMovementsTabProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [documentsByMovement, setDocumentsByMovement] = useState<Map<number, Document[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [docFilter, setDocFilter] = useState<"all" | "with_docs" | "without_docs">("all");

  useEffect(() => {
    fetchData();
  }, [processId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Paginate movements to get ALL (not limited to 1000)
      let allMovements: Movement[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("process_movements")
          .select("id, cod_andamento, movement_type, tipo_andamento, description, movement_date, data_andamento, created_at")
          .eq("process_id", processId)
          .order("data_andamento", { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allMovements = allMovements.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setMovements(allMovements);

      const { data: docData, error: docError } = await supabase
        .from("process_documents")
        .select("id, cod_documento, cod_andamento, nome_arquivo, tipo_documento, documento_url, storage_path")
        .eq("process_id", processId)
        .not("cod_andamento", "is", null);
      if (docError) throw docError;

      const docMap = new Map<number, Document[]>();
      for (const doc of docData || []) {
        if (doc.cod_andamento) {
          const list = docMap.get(doc.cod_andamento) || [];
          list.push(doc);
          docMap.set(doc.cod_andamento, list);
        }
      }
      setDocumentsByMovement(docMap);
    } catch (error) {
      console.error("Error fetching movements:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = movements.filter((m) => {
    if (docFilter === "all") return true;
    const hasDocs = m.cod_andamento ? (documentsByMovement.get(m.cod_andamento)?.length || 0) > 0 : false;
    return docFilter === "with_docs" ? hasDocs : !hasDocs;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse text-center">Carregando andamentos...</div>
        </CardContent>
      </Card>
    );
  }

  if (movements.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Nenhum andamento encontrado para este processo
            </p>
            <p className="text-xs text-muted-foreground">
              Os andamentos são sincronizados automaticamente quando disponíveis na Solucionare.
              Processos recém-cadastrados podem ainda não ter movimentações registradas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Andamentos ({movements.length})
            </CardTitle>
            <CardDescription>
              Histórico de movimentações do processo
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={docFilter} onValueChange={(v) => setDocFilter(v as any)}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({movements.length})</SelectItem>
                <SelectItem value="with_docs">Com documentos</SelectItem>
                <SelectItem value="without_docs">Sem documentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredMovements.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            Nenhum andamento encontrado com o filtro selecionado.
          </p>
        ) : (
          <div className="space-y-4">
            {filteredMovements.map((movement) => {
              const docs = movement.cod_andamento ? documentsByMovement.get(movement.cod_andamento) || [] : [];
              return (
                <div
                  key={movement.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {movement.tipo_andamento && (
                          <Badge variant="outline">{movement.tipo_andamento}</Badge>
                        )}
                        {movement.cod_andamento && (
                          <span className="text-xs text-muted-foreground">
                            Código: {movement.cod_andamento}
                          </span>
                        )}
                        {docs.length > 0 && (
                          <Badge className="bg-blue-600 text-white text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            {docs.length} doc{docs.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{movement.description || "Sem descrição"}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {(movement.data_andamento || movement.movement_date)
                        ? new Date(movement.data_andamento || movement.movement_date!).toLocaleDateString("pt-BR")
                        : "-"}
                    </div>
                  </div>
                  {docs.length > 0 && (
                    <div className="mt-2 pt-2 border-t space-y-1.5">
                      {docs.map((doc) => {
                        const url = doc.documento_url || null;
                        return (
                          <div key={doc.id} className="flex items-center justify-between text-sm bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="font-medium text-blue-800 dark:text-blue-300">{doc.nome_arquivo || `Documento ${doc.cod_documento}`}</span>
                              {doc.tipo_documento && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">{doc.tipo_documento}</Badge>
                              )}
                            </div>
                            {url && (
                              <Button variant="outline" size="sm" className="h-7 px-3 gap-1 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900" asChild>
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Abrir
                                </a>
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
