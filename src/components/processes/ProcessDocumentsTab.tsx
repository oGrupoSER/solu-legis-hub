import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink, RefreshCw, CloudDownload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Document {
  id: string;
  cod_documento: number;
  tipo_documento: string | null;
  nome_arquivo: string | null;
  documento_url: string | null;
  storage_path: string | null;
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
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadAll = async () => {
    try {
      setDownloading(true);
      toast.info("Baixando documentos da Solucionare para o Storage...");
      
      const { data, error } = await supabase.functions.invoke("download-process-documents", {
        body: { processId, limit: 50 },
      });

      if (error) throw error;

      if (data.downloaded > 0) {
        toast.success(`${data.downloaded} documento(s) baixado(s) com sucesso`);
        fetchDocuments(); // Refresh to show updated URLs
      } else if (data.failed > 0) {
        toast.warning(`${data.failed} documento(s) falharam no download`);
      } else {
        toast.info("Todos os documentos já estão armazenados localmente");
      }
    } catch (error) {
      console.error("Error downloading documents:", error);
      toast.error("Erro ao baixar documentos");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSingle = async (docId: string) => {
    try {
      toast.info("Baixando documento...");
      const { data, error } = await supabase.functions.invoke("download-process-documents", {
        body: { documentId: docId },
      });

      if (error) throw error;

      if (data.downloaded > 0) {
        toast.success("Documento baixado com sucesso");
        fetchDocuments();
      } else {
        toast.warning("Não foi possível baixar o documento");
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error("Erro ao baixar documento");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isStoredLocally = (doc: Document) => !!doc.storage_path;

  const pendingDownloads = documents.filter(d => !d.storage_path && d.documento_url).length;

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentos ({documents.length})
            </CardTitle>
            <CardDescription>
              Documentos anexados ao processo
              {pendingDownloads > 0 && (
                <span className="ml-2 text-amber-500">
                  ({pendingDownloads} pendente{pendingDownloads > 1 ? "s" : ""} de download)
                </span>
              )}
            </CardDescription>
          </div>
          {pendingDownloads > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={downloading}
              className="gap-2"
            >
              <CloudDownload className={`h-4 w-4 ${downloading ? "animate-pulse" : ""}`} />
              Baixar Todos
            </Button>
          )}
        </div>
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
                    {isStoredLocally(doc) ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        Armazenado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
                        Externo
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!isStoredLocally(doc) && doc.documento_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadSingle(doc.id)}
                    title="Baixar para o Storage"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
