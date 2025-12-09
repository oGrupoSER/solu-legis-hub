import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Document {
  id: string;
  cod_documento: number;
  tipo_documento: string | null;
  nome_arquivo: string | null;
  documento_url: string | null;
  tamanho_bytes: number | null;
  created_at: string | null;
  is_confirmed: boolean | null;
}

interface ProcessDocumentsTabProps {
  processId: string;
}

export function ProcessDocumentsTab({ processId }: ProcessDocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [processId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("process_documents")
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse text-center">Carregando documentos...</div>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Nenhum documento encontrado para este processo
            </p>
            <p className="text-xs text-muted-foreground">
              Os documentos são sincronizados automaticamente quando disponíveis na Solucionare.
              Processos recém-cadastrados podem ainda não ter documentos registrados.
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
          <FileText className="h-5 w-5" />
          Documentos ({documents.length})
        </CardTitle>
        <CardDescription>
          Documentos anexados ao processo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between border rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {doc.nome_arquivo || `Documento ${doc.cod_documento}`}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {doc.tipo_documento && (
                      <Badge variant="secondary" className="text-xs">
                        {doc.tipo_documento}
                      </Badge>
                    )}
                    <span>{formatFileSize(doc.tamanho_bytes)}</span>
                    <span>Código: {doc.cod_documento}</span>
                  </div>
                </div>
              </div>
              
              {doc.documento_url && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a 
                    href={doc.documento_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
