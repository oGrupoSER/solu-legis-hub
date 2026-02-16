import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, CheckCircle, AlertCircle, Archive, Clock, Send } from "lucide-react";

interface ProcessStats {
  total: number;
  pending: number;
  registered: number;
  error: number;
  archived: number;
  other: number;
}

export const ProcessesStats = ({ refreshTrigger }: { refreshTrigger?: number }) => {
  const [stats, setStats] = useState<ProcessStats>({
    total: 0, pending: 0, registered: 0, error: 0, archived: 0, other: 0,
  });

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("processes")
        .select("status_code");

      if (error) throw error;

      const s: ProcessStats = { total: 0, pending: 0, registered: 0, error: 0, archived: 0, other: 0 };
      s.total = data?.length || 0;
      data?.forEach((p) => {
        switch (p.status_code) {
          case 1: s.pending++; break;      // Pendente
          case 4: s.registered++; break;   // Cadastrado
          case 7: s.error++; break;        // Erro na Validação
          case 8: s.archived++; break;     // Arquivado
          default: s.other++; break;
        }
      });
      setStats(s);
    } catch (error) {
      console.error("Error fetching process stats:", error);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total</CardTitle>
          <Gavel className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">Processos cadastrados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          <Clock className="h-4 w-4 text-warning" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pending}</div>
          <p className="text-xs text-muted-foreground">Aguardando envio</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cadastrados</CardTitle>
          <CheckCircle className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.registered}</div>
          <p className="text-xs text-muted-foreground">Validados com sucesso</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Erro na Validação</CardTitle>
          <AlertCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.error}</div>
          <p className="text-xs text-muted-foreground">Necessitam correção</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Arquivados</CardTitle>
          <Archive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.archived}</div>
          <p className="text-xs text-muted-foreground">Processos arquivados</p>
        </CardContent>
      </Card>
    </div>
  );
};
