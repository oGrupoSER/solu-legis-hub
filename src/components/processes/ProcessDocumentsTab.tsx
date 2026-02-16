import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, ExternalLink, CloudDownload, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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

type FilterType = "all" | "available" | "expired";

export function ProcessDocumentsTab({ processId }: ProcessDocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

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
        fetchDocuments();
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
  const isExpired = (doc: Document) => !doc.storage_path && !doc.documento_url;

  const filteredDocuments = documents.filter((doc) => {
    if (filter === "available") return isStoredLocally(doc);
    if (filter === "expired") return isExpired(doc);
    return true;
  });

  const storedCount = documents.filter(isStoredLocally).length;
  const expiredCount = documents.filter(isExpired).length;
  const pendingCount = documents.filter(d => !d.storage_path && d.documento_url).length;

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
            <CardDescription className="flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> {storedCount} disponíveis
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <CloudDownload className="h-3.5 w-3.5" /> {pendingCount} pendentes
                </span>
              )}
              {expiredCount > 0 && (
                <span className="inline-flex items-center gap-1 text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> {expiredCount} expirados
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Filtrar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({documents.length})</SelectItem>
                <SelectItem value="available">Disponíveis ({storedCount})</SelectItem>
                <SelectItem value="expired">Expirados ({expiredCount})</SelectItem>
              </SelectContent>
            </Select>
            {pendingCount > 0 && (
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredDocuments.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhum documento encontrado com o filtro selecionado.
            </div>
          )}
          {filteredDocuments.map((doc) => {
            const stored = isStoredLocally(doc);
            const expired = isExpired(doc);

            return (
              <div
                key={doc.id}
                className={`flex items-center justify-between border rounded-lg p-4 ${
                  expired ? "opacity-60 bg-muted/30 border-destructive/30" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded flex items-center justify-center ${
                    expired ? "bg-destructive/10" : stored ? "bg-green-500/10" : "bg-muted"
                  }`}>
                    {expired ? (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : (
                      <FileText className={`h-5 w-5 ${stored ? "text-green-600" : "text-muted-foreground"}`} />
                    )}
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${expired ? "line-through text-muted-foreground" : ""}`}>
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
                      {stored ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Disponível
                        </Badge>
                      ) : expired ? (
                        <Badge variant="outline" className="text-xs text-destructive border-destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Expirado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
                          <CloudDownload className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!stored && doc.documento_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadSingle(doc.id)}
                      title="Baixar para o Storage"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  {stored && doc.documento_url && (
                    <Button variant="outline" size="sm" asChild>
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
                  {expired && (
                    <span className="text-xs text-destructive italic">Indisponível</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
