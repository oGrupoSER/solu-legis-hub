import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Building, User, MapPin, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
}

interface ProcessCoverTabProps {
  processId: string;
}

export function ProcessCoverTab({ processId }: ProcessCoverTabProps) {
  const [cover, setCover] = useState<Cover | null>(null);
  const [loading, setLoading] = useState(true);

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
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Capa do Processo
        </CardTitle>
        <CardDescription>
          Informações principais extraídas da capa processual
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Localização */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Localização
            </h4>
            <div className="grid gap-3 pl-6">
              <div>
                <p className="text-xs text-muted-foreground">Tribunal</p>
                <p className="text-sm font-medium">{cover.tribunal || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comarca</p>
                <p className="text-sm font-medium">{cover.comarca || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vara</p>
                <p className="text-sm font-medium">{cover.vara || "-"}</p>
              </div>
            </div>
          </div>

          {/* Classificação */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              Classificação
            </h4>
            <div className="grid gap-3 pl-6">
              <div>
                <p className="text-xs text-muted-foreground">Classe</p>
                <p className="text-sm font-medium">{cover.classe || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Área</p>
                <p className="text-sm font-medium">{cover.area || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Natureza</p>
                <p className="text-sm font-medium">{cover.natureza || "-"}</p>
              </div>
            </div>
          </div>

          {/* Assunto e Ação */}
          <div className="space-y-4">
            <h4 className="font-medium">Assunto e Tipo de Ação</h4>
            <div className="grid gap-3 pl-6">
              <div>
                <p className="text-xs text-muted-foreground">Assunto</p>
                <p className="text-sm font-medium">{cover.assunto || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Ação</p>
                <p className="text-sm font-medium">{cover.tipo_acao || "-"}</p>
              </div>
            </div>
          </div>

          {/* Magistrado e Situação */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Magistrado e Status
            </h4>
            <div className="grid gap-3 pl-6">
              <div>
                <p className="text-xs text-muted-foreground">Juiz</p>
                <p className="text-sm font-medium">{cover.juiz || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Situação</p>
                {cover.situacao ? (
                  <Badge variant="outline">{cover.situacao}</Badge>
                ) : (
                  <p className="text-sm font-medium">-</p>
                )}
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Datas
            </h4>
            <div className="grid gap-3 pl-6">
              <div>
                <p className="text-xs text-muted-foreground">Data de Distribuição</p>
                <p className="text-sm font-medium">
                  {cover.data_distribuicao
                    ? new Date(cover.data_distribuicao).toLocaleDateString("pt-BR")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última Atualização</p>
                <p className="text-sm font-medium">
                  {cover.data_atualizacao
                    ? new Date(cover.data_atualizacao).toLocaleDateString("pt-BR")
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Valor da Causa */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Valor
            </h4>
            <div className="grid gap-3 pl-6">
              <div>
                <p className="text-xs text-muted-foreground">Valor da Causa</p>
                <p className="text-sm font-medium text-lg">
                  {formatCurrency(cover.valor_causa)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
