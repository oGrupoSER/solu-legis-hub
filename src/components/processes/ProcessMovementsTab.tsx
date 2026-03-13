import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, FileText, ExternalLink } from "lucide-react";
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

  useEffect(() => {
    fetchData();
  }, [processId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [movResult, docResult] = await Promise.all([
        supabase
          .from("process_movements")
          .select("*")
          .eq("process_id", processId)
          .order("data_andamento", { ascending: false, nullsFirst: false }),
        supabase
          .from("process_documents")
          .select("id, cod_documento, cod_andamento, nome_arquivo, tipo_documento, documento_url, storage_path")
          .eq("process_id", processId)
          .not("cod_andamento", "is", null),
      ]);

      if (movResult.error) throw movResult.error;
      setMovements(movResult.data || []);

      const docMap = new Map<number, Document[]>();
      for (const doc of docResult.data || []) {
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
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Andamentos ({movements.length})
        </CardTitle>
        <CardDescription>
          Histórico de movimentações do processo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {movements.map((movement) => {
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
                        <div key={doc.id} className="flex items-center justify-between text-sm bg-muted/40 rounded px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{doc.nome_arquivo || `Documento ${doc.cod_documento}`}</span>
                            {doc.tipo_documento && (
                              <Badge variant="secondary" className="text-xs">{doc.tipo_documento}</Badge>
                            )}
                          </div>
                          {url && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1" asChild>
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
      </CardContent>
    </Card>
  );
}
