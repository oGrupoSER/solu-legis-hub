import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, CheckCircle, AlertCircle, Archive, Clock, CircleDot, LucideIcon } from "lucide-react";

interface StatusGroup {
  status_description: string;
  status_code: number | null;
  count: number;
}

const STATUS_CONFIG: Record<number, { icon: LucideIcon; colorClass: string }> = {
  1: { icon: Clock, colorClass: "text-warning" },
  4: { icon: CheckCircle, colorClass: "text-success" },
  5: { icon: Archive, colorClass: "text-muted-foreground" },
  7: { icon: AlertCircle, colorClass: "text-destructive" },
};

const DEFAULT_CONFIG = { icon: CircleDot, colorClass: "text-primary" };

export const ProcessesStats = ({ refreshTrigger }: { refreshTrigger?: number }) => {
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<StatusGroup[]>([]);

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("processes")
        .select("status_code, status_description");

      if (error) throw error;

      const map = new Map<string, StatusGroup>();
      (data || []).forEach((p) => {
        const key = p.status_description || "Sem status";
        if (!map.has(key)) {
          map.set(key, { status_description: key, status_code: p.status_code, count: 0 });
        }
        map.get(key)!.count++;
      });

      setTotal(data?.length || 0);
      setGroups(Array.from(map.values()).sort((a, b) => (b.count - a.count)));
    } catch (error) {
      console.error("Error fetching process stats:", error);
    }
  };

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total</CardTitle>
          <Gavel className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{total}</div>
          <p className="text-xs text-muted-foreground">Processos cadastrados</p>
        </CardContent>
      </Card>

      {groups.map((g) => {
        const config = (g.status_code != null && STATUS_CONFIG[g.status_code]) || DEFAULT_CONFIG;
        const Icon = config.icon;
        return (
          <Card key={g.status_description}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium truncate">{g.status_description}</CardTitle>
              <Icon className={`h-4 w-4 shrink-0 ${config.colorClass}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{g.count}</div>
              <p className="text-xs text-muted-foreground">
                {total > 0 ? `${((g.count / total) * 100).toFixed(0)}% do total` : "—"}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export { STATUS_CONFIG };
