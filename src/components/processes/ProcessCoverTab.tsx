import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Building, User, MapPin, Calendar, DollarSign, Code, Monitor, Link, Scale, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Cover {
  id: string;
  comarca: string | null;
  vara: string | null;
  tribunal: string | null;
  assunto: string | null;
  natureza: string | null;
  tipo_acao: string | null;
  classe: string | null;
  juiz: string | null;
  situacao: string | null;
  area: string | null;
  valor_causa: number | null;
  data_distribuicao: string | null;
  data_atualizacao: string | null;
  digital: boolean | null;
  cod_sistema: number | null;
  sigla_sistema: string | null;
  nome_sistema: string | null;
  link_consulta_processo: string | null;
  cod_agrupador: number | null;
  cod_processo: number | null;
  raw_data: Json;
}

interface Party {
  nome?: string;
  cpf?: string | null;
  cnpj?: string | null;
  descricaoTipoPolo?: string;
  codProcessoPolo?: number;
}

interface Lawyer {
  nome?: string;
  oab?: string;
  cpf?: string | null;
  cnpj?: string | null;
}

interface ProcessCoverTabProps {
  processId: string;
}

function PersonList({ title, icon, people }: { title: string; icon: React.ReactNode; people: Party[] | Lawyer[] }) {
  if (!people || people.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className="font-medium flex items-center gap-2">{icon}{title}</h4>
      <div className="grid gap-2 pl-6">
        {people.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-3 rounded-md border p-3 bg-muted/30">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.nome || "-"}</p>
              <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                {p.descricaoTipoPolo && <span>{p.descricaoTipoPolo}</span>}
                {p.oab && <span>OAB: {p.oab}</span>}
                {p.cpf && <span>CPF: {p.cpf}</span>}
                {p.cnpj && <span>CNPJ: {p.cnpj}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value || "-"}</div>
    </div>
  );
}

export function ProcessCoverTab({ processId }: ProcessCoverTabProps) {
  const [cover, setCover] = useState<Cover | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    fetchCover();
  }, [processId]);

  const fetchCover = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("process_covers")
        .select("*")
        .eq("process_id", processId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCover(data);
    } catch (error) {
      console.error("Error fetching cover:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse text-center">Carregando capa...</div>
        </CardContent>
      </Card>
    );
  }

  if (!cover) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Capa do processo não disponível. Sincronize para obter os dados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const rawData = (cover.raw_data || {}) as Record<string, any>;
  const autores = (rawData.autor || []) as Party[];
  const reus = (rawData.reu || []) as Party[];
  const advogados = (rawData.advogadoProcesso || []) as Lawyer[];
  const outros = (rawData.outrosEnvolvidos || []) as Party[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Capa do Processo
          </CardTitle>
          <CardDescription>
            Informações principais extraídas da capa processual
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowJson(!showJson)}>
          <Code className="h-4 w-4 mr-1" />
          {showJson ? "Ver Formatado" : "Ver JSON"}
        </Button>
      </CardHeader>
      <CardContent>
        {showJson ? (
          <ScrollArea className="h-[500px]">
            <pre className="bg-muted p-4 rounded-md text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          </ScrollArea>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Identificação */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Identificação
                </h4>
                <div className="grid gap-3 pl-6">
                  <InfoField label="Cód. Processo" value={cover.cod_processo} />
                  <InfoField label="Cód. Agrupador" value={cover.cod_agrupador} />
                </div>
              </div>

              {/* Localização */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Localização
                </h4>
                <div className="grid gap-3 pl-6">
                  <InfoField label="Tribunal" value={cover.tribunal} />
                  <InfoField label="Comarca" value={cover.comarca} />
                  <InfoField label="Vara" value={cover.vara} />
                </div>
              </div>

              {/* Classificação */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  Classificação
                </h4>
                <div className="grid gap-3 pl-6">
                  <InfoField label="Classe" value={cover.classe} />
                  <InfoField label="Área" value={cover.area} />
                  <InfoField label="Natureza" value={cover.natureza} />
                  <InfoField label="Assunto" value={cover.assunto} />
                  <InfoField label="Tipo de Ação" value={cover.tipo_acao} />
                </div>
              </div>

              {/* Magistrado e Situação */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Magistrado e Status
                </h4>
                <div className="grid gap-3 pl-6">
                  <InfoField label="Juiz" value={cover.juiz} />
                  <InfoField
                    label="Situação"
                    value={cover.situacao ? <Badge variant="outline">{cover.situacao}</Badge> : "-"}
                  />
                </div>
              </div>

              {/* Sistema */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  Sistema
                </h4>
                <div className="grid gap-3 pl-6">
                  <InfoField label="Nome do Sistema" value={cover.nome_sistema} />
                  <InfoField label="Sigla" value={cover.sigla_sistema} />
                  <InfoField label="Cód. Sistema" value={cover.cod_sistema} />
                  <InfoField
                    label="Digital"
                    value={
                      cover.digital !== null ? (
                        <Badge variant={cover.digital ? "default" : "secondary"}>
                          {cover.digital ? "Sim" : "Não"}
                        </Badge>
                      ) : "-"
                    }
                  />
                </div>
              </div>

              {/* Datas e Valor */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Datas e Valor
                </h4>
                <div className="grid gap-3 pl-6">
                  <InfoField
                    label="Data de Distribuição"
                    value={cover.data_distribuicao ? new Date(cover.data_distribuicao).toLocaleDateString("pt-BR") : null}
                  />
                  <InfoField
                    label="Última Atualização"
                    value={cover.data_atualizacao ? new Date(cover.data_atualizacao).toLocaleDateString("pt-BR") : null}
                  />
                  <InfoField
                    label="Valor da Causa"
                    value={
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(cover.valor_causa)}
                      </span>
                    }
                  />
                </div>
              </div>
            </div>

            {/* Link consulta */}
            {cover.link_consulta_processo && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Link className="h-4 w-4 text-muted-foreground" />
                  Link de Consulta
                </h4>
                <a
                  href={cover.link_consulta_processo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline break-all pl-6"
                >
                  {cover.link_consulta_processo}
                </a>
              </div>
            )}

            {/* Partes - ocultas pois já existe aba dedicada */}
            {/* {(autores.length > 0 || reus.length > 0 || advogados.length > 0 || outros.length > 0) && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Partes e Envolvidos
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <PersonList title="Autor (Polo Ativo)" icon={<User className="h-4 w-4 text-muted-foreground" />} people={autores} />
                  <PersonList title="Réu (Polo Passivo)" icon={<User className="h-4 w-4 text-muted-foreground" />} people={reus} />
                  <PersonList title="Advogados" icon={<Scale className="h-4 w-4 text-muted-foreground" />} people={advogados} />
                  <PersonList title="Outros Envolvidos" icon={<Users className="h-4 w-4 text-muted-foreground" />} people={outros} />
                </div>
              </div>
            )} */}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
