import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2, MapPin, Scale, FileText, Users, Gavel,
  Calendar, Hash, ExternalLink, Download, User
} from "lucide-react";

interface DistributionDetailDialogProps {
  distribution: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function PersonList({ title, data, icon: Icon }: { title: string; data: any; icon: any }) {
  if (!data) return null;
  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((person: any, idx: number) => (
          <div key={idx} className="text-sm border-b last:border-0 pb-2 last:pb-0">
            <p className="font-medium">{person.nome || person.nomeCompleto || person.name || JSON.stringify(person)}</p>
            {person.cpf && <p className="text-xs text-muted-foreground">CPF: {person.cpf}</p>}
            {person.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {person.cnpj}</p>}
            {person.tipoPessoa && <Badge variant="outline" className="mt-1 text-xs">{person.tipoPessoa}</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function extractDocuments(distribution: any): any[] {
  const docs: any[] = [];
  const docIniciais = distribution?.documentos_iniciais;
  const listaDocs = distribution?.lista_documentos;

  if (Array.isArray(docIniciais)) {
    docIniciais.forEach((d: any) => docs.push({ ...d, _source: "Documento Inicial" }));
  }
  if (Array.isArray(listaDocs)) {
    listaDocs.forEach((d: any) => docs.push({ ...d, _source: "Documento" }));
  }
  return docs;
}

export function DistributionDetailDialog({ distribution, open, onOpenChange }: DistributionDetailDialogProps) {
  if (!distribution) return null;

  const documents = extractDocuments(distribution);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5" />
            Distribuição — {distribution.process_number}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">Dados Gerais</TabsTrigger>
            <TabsTrigger value="documents" className="flex-1">
              Documentos
              {documents.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">{documents.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Identificação */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Identificação
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InfoItem icon={Hash} label="Número do Processo" value={distribution.process_number} />
                <InfoItem icon={Building2} label="Tribunal" value={distribution.tribunal} />
                <InfoItem icon={Scale} label="Tipo do Processo" value={distribution.tipo_do_processo} />
                <InfoItem icon={Hash} label="Instância" value={distribution.instancia?.toString()} />
                <InfoItem icon={Hash} label="Sistema" value={distribution.sigla_sistema} />
                <InfoItem icon={Hash} label="Processo Originário" value={distribution.processo_originario} />
              </CardContent>
            </Card>

            {/* Localização */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Localização
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InfoItem icon={MapPin} label="Comarca" value={distribution.comarca} />
                <InfoItem icon={Building2} label="Órgão Julgador" value={distribution.orgao_julgador} />
                <InfoItem icon={MapPin} label="Cidade" value={distribution.cidade} />
                <InfoItem icon={MapPin} label="UF" value={distribution.uf} />
              </CardContent>
            </Card>

            {/* Magistrado e Valores */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Gavel className="h-4 w-4" />
                  Magistrado e Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InfoItem icon={Gavel} label="Magistrado" value={distribution.magistrado} />
                <InfoItem icon={Scale} label="Valor da Causa" value={distribution.valor_da_causa} />
                <InfoItem icon={Calendar} label="Data Distribuição" value={distribution.distribution_date ? format(new Date(distribution.distribution_date), "dd/MM/yyyy", { locale: ptBR }) : null} />
                <InfoItem icon={Calendar} label="Data Audiência" value={distribution.data_audiencia ? format(new Date(distribution.data_audiencia), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null} />
                {distribution.tipo_audiencia && (
                  <InfoItem icon={Calendar} label="Tipo Audiência" value={distribution.tipo_audiencia} />
                )}
              </CardContent>
            </Card>

            {/* Termo e Nome Pesquisado */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Monitoramento
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InfoItem icon={FileText} label="Termo Monitorado" value={distribution.term} />
                <InfoItem icon={User} label="Nome Pesquisado" value={distribution.nome_pesquisado} />
              </CardContent>
            </Card>

            {/* Partes */}
            <PersonList title="Autor" data={distribution.autor} icon={Users} />
            <PersonList title="Réu" data={distribution.reu} icon={Users} />
            <PersonList title="Outros Envolvidos" data={distribution.outros_envolvidos} icon={Users} />

            {/* Advogados */}
            {distribution.advogados && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Advogados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(Array.isArray(distribution.advogados) ? distribution.advogados : [distribution.advogados]).map((adv: any, idx: number) => (
                    <div key={idx} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                      <p className="font-medium">{adv.nome || adv.nomeAdvogado || adv.name || JSON.stringify(adv)}</p>
                      {adv.oab && <p className="text-xs text-muted-foreground">OAB: {adv.oab}</p>}
                      {adv.numOab && <p className="text-xs text-muted-foreground">OAB: {adv.numOab} {adv.ufOab || ""}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Assuntos */}
            {distribution.assuntos && Array.isArray(distribution.assuntos) && distribution.assuntos.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Assuntos
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {distribution.assuntos.map((a: any, idx: number) => (
                    <Badge key={idx} variant="outline">{typeof a === "string" ? a : a.descricao || a.nome || JSON.stringify(a)}</Badge>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Movimentos */}
            {distribution.movimentos && Array.isArray(distribution.movimentos) && distribution.movimentos.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Movimentações ({distribution.movimentos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-60 overflow-y-auto">
                  {distribution.movimentos.map((mov: any, idx: number) => (
                    <div key={idx} className="border-l-2 border-muted pl-3 py-1">
                      <p className="text-sm font-medium">{mov.tipoAndamento || mov.tipo || mov.descricao || "Movimentação"}</p>
                      {mov.dataAndamento && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(mov.dataAndamento), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      {mov.descricao && mov.descricao !== mov.tipoAndamento && (
                        <p className="text-xs text-muted-foreground mt-1">{mov.descricao}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum documento vinculado a esta distribuição</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc, idx) => {
                  const name = doc.nomeArquivo || doc.nome_arquivo || doc.nome || doc.fileName || `Documento ${idx + 1}`;
                  const type = doc.tipoDocumento || doc.tipo_documento || doc.tipo || null;
                  const url = doc.url || doc.documento_url || doc.link || null;
                  const size = doc.tamanhoBytes || doc.tamanho_bytes || null;

                  return (
                    <Card key={idx}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {type && <Badge variant="outline" className="text-xs">{type}</Badge>}
                              <Badge variant="secondary" className="text-xs">{doc._source}</Badge>
                              {size && <span className="text-xs text-muted-foreground">{(size / 1024).toFixed(0)} KB</span>}
                            </div>
                          </div>
                        </div>
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 ml-2">
                            <Badge variant="default" className="cursor-pointer flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              Abrir
                            </Badge>
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
