import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
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

interface ProcessMovementsTabProps {
  processId: string;
}

export function ProcessMovementsTab({ processId }: ProcessMovementsTabProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovements();
  }, [processId]);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("process_movements")
        .select("*")
        .eq("process_id", processId)
        .order("data_andamento", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setMovements(data || []);
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
          {movements.map((movement) => (
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
