import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, CheckCircle, AlertCircle, Archive, Clock, CircleDot, ShieldAlert, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusGroup {
  status_description: string;
  status_code: number | null;
  count: number;
}

interface ProcessesStatsProps {
  refreshTrigger?: number;
  onStatusClick?: (status: string) => void;
  activeStatus?: string;
}

const STATUS_CONFIG: Record<number, { icon: LucideIcon; colorClass: string }> = {
  1: { icon: Clock, colorClass: "text-warning" },
  2: { icon: Clock, colorClass: "text-warning" },
  4: { icon: CheckCircle, colorClass: "text-success" },
  5: { icon: Archive, colorClass: "text-muted-foreground" },
  6: { icon: ShieldAlert, colorClass: "text-purple-600" },
  7: { icon: AlertCircle, colorClass: "text-destructive" },
};

const DEFAULT_CONFIG = { icon: CircleDot, colorClass: "text-primary" };

async function fetchAllProcessStatuses() {
  const PAGE_SIZE = 1000;
  let allData: { status_code: number | null; status_description: string | null }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("processes")
      .select("status_code, status_description")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
}

export const ProcessesStats = ({ refreshTrigger, onStatusClick, activeStatus }: ProcessesStatsProps) => {
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<StatusGroup[]>([]);

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchStats = async () => {
    try {
      const data = await fetchAllProcessStatuses();

      const map = new Map<string, StatusGroup>();
      data.forEach((p) => {
        const key = p.status_description || "Sem status";
        if (!map.has(key)) {
          map.set(key, { status_description: key, status_code: p.status_code, count: 0 });
        }
        map.get(key)!.count++;
      });

      setTotal(data.length);
      setGroups(Array.from(map.values()).sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error("Error fetching process stats:", error);
    }
  };

  const isActive = (status: string) => activeStatus === status;

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md",
          isActive("all") && "ring-2 ring-primary"
        )}
        onClick={() => onStatusClick?.("all")}
      >
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
          <Card
            key={g.status_description}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isActive(g.status_description) && "ring-2 ring-primary"
            )}
            onClick={() => onStatusClick?.(g.status_description)}
          >
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
