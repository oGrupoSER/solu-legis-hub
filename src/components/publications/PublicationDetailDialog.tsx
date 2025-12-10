import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, Calendar, FileText, Tag, Building2, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { HighlightedContent } from "./HighlightedContent";

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

interface PublicationDetailDialogProps {
  publication: Publication;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublicationDetailDialog({
  publication,
  open,
  onOpenChange,
}: PublicationDetailDialogProps) {
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(publication.raw_data, null, 2));
    toast.success("JSON copiado para a área de transferência");
  };

  const handleDownloadJson = () => {
    const dataStr = JSON.stringify(publication.raw_data, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `publicacao-${publication.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("JSON baixado com sucesso");
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(publication.content || "");
    toast.success("Conteúdo copiado para a área de transferência");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Publicação - ${publication.gazette_name || "Diário Oficial"}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
              h1 { font-size: 18px; margin-bottom: 10px; }
              .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
              .content { white-space: pre-wrap; font-size: 14px; }
              .terms { margin-top: 20px; padding: 10px; background: #f5f5f5; }
              .terms span { display: inline-block; margin: 2px; padding: 2px 8px; background: #e0e0e0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>${publication.gazette_name || "Publicação"}</h1>
            <div class="meta">
              Data: ${publication.publication_date ? format(new Date(publication.publication_date), "dd/MM/yyyy") : "N/A"}
            </div>
            <div class="content">${publication.content || ""}</div>
            ${publication.matched_terms && publication.matched_terms.length > 0 ? `
              <div class="terms">
                <strong>Termos encontrados:</strong><br>
                ${publication.matched_terms.map(t => `<span>${t}</span>`).join("")}
              </div>
            ` : ""}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detalhes da Publicação
          </DialogTitle>
          <DialogDescription>
            Visualize o conteúdo completo e os dados originais da publicação
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="metadata">Metadados</TabsTrigger>
            <TabsTrigger value="raw">JSON Original</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 overflow-hidden">
            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
              <div className="flex gap-2 mb-4">
                <Button onClick={handleCopyContent} variant="outline" size="sm" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copiar
                </Button>
                <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>
              <div className="space-y-4 max-w-full">
                <div className="overflow-hidden">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Conteúdo da Publicação</h3>
                  <div className="prose prose-sm max-w-none overflow-hidden">
                    <div className="text-foreground whitespace-pre-wrap break-all leading-relaxed overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      <HighlightedContent
                        content={publication.content || "Sem conteúdo disponível"}
                        terms={publication.matched_terms || []}
                        maxLength={99999}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="metadata" className="space-y-4">
            <ScrollArea className="h-[500px] w-full rounded-md border p-4">
              <div className="space-y-6">
                {/* Date Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    Informações de Data
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Data de Publicação:</span>
                      <p className="font-medium mt-1">
                        {publication.publication_date
                          ? format(new Date(publication.publication_date), "dd/MM/yyyy")
                          : "Não disponível"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data de Sincronização:</span>
                      <p className="font-medium mt-1">
                        {format(new Date(publication.created_at), "dd/MM/yyyy HH:mm:ss")}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Gazette Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Informações da Gazeta
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Nome da Gazeta:</span>
                    <p className="font-medium mt-1">{publication.gazette_name || "Não disponível"}</p>
                  </div>
                </div>

                <Separator />

                {/* Terms */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Tag className="h-4 w-4 text-primary" />
                    Termos Encontrados
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {publication.matched_terms && publication.matched_terms.length > 0 ? (
                      publication.matched_terms.map((term, idx) => (
                        <Badge key={idx} variant="secondary">
                          {term}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum termo específico</span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Partner Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-primary" />
                    Informações do Parceiro
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Parceiro:</span>
                      <p className="font-medium mt-1">{publication.partners?.name || "Não disponível"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Serviço:</span>
                      <p className="font-medium mt-1">
                        {publication.partner_services?.service_name || "Não disponível"}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* IDs */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Identificadores</div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="font-mono bg-muted p-2 rounded">
                      <span className="text-muted-foreground">ID da Publicação:</span>
                      <p className="mt-1 break-all">{publication.id}</p>
                    </div>
                    {publication.partner_id && (
                      <div className="font-mono bg-muted p-2 rounded">
                        <span className="text-muted-foreground">ID do Parceiro:</span>
                        <p className="mt-1 break-all">{publication.partner_id}</p>
                      </div>
                    )}
                    {publication.partner_service_id && (
                      <div className="font-mono bg-muted p-2 rounded">
                        <span className="text-muted-foreground">ID do Serviço:</span>
                        <p className="mt-1 break-all">{publication.partner_service_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="raw" className="space-y-4 overflow-hidden">
            <div className="flex gap-2">
              <Button onClick={handleCopyJson} variant="outline" size="sm" className="gap-2">
                <Copy className="h-4 w-4" />
                Copiar JSON
              </Button>
              <Button onClick={handleDownloadJson} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Baixar JSON
              </Button>
            </div>

            <ScrollArea className="h-[450px] w-full rounded-md border overflow-hidden">
              <pre className="p-4 text-xs whitespace-pre-wrap overflow-hidden max-w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                <code className="language-json font-mono block max-w-full">
                  {JSON.stringify(publication.raw_data, null, 2)}
                </code>
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
