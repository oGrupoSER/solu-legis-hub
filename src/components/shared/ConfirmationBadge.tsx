import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ConfirmationDetail {
  id: string;
  confirmed_at: string;
  ip_address: string | null;
  client_name: string;
}

interface ConfirmationBadgeProps {
  recordId: string;
  recordType: "publications" | "distributions" | "movements";
  isConfirmed?: boolean; // pre-loaded from parent to avoid N+1
}

export function ConfirmationBadge({ recordId, recordType, isConfirmed }: ConfirmationBadgeProps) {
  const [details, setDetails] = useState<ConfirmationDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchDetails = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("record_confirmations")
        .select("id, confirmed_at, ip_address, client_system_id")
        .eq("record_id", recordId)
        .eq("record_type", recordType)
        .order("confirmed_at", { ascending: false });

      if (data && data.length > 0) {
        const clientIds = [...new Set(data.map((d) => d.client_system_id))];
        const { data: clients } = await supabase
          .from("client_systems")
          .select("id, name")
          .in("id", clientIds);

        const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c.name]));

        setDetails(
          data.map((d) => ({
            id: d.id,
            confirmed_at: d.confirmed_at,
            ip_address: d.ip_address,
            client_name: clientMap[d.client_system_id] || "Desconhecido",
          }))
        );
      }
      setLoaded(true);
    } catch (err) {
      console.error("Error fetching confirmation details:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={fetchDetails}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-muted",
            isConfirmed
              ? "text-primary"
              : "text-muted-foreground"
          )}
          title={isConfirmed ? "Confirmado" : "Não confirmado"}
        >
          {isConfirmed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : details.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nenhuma confirmação registrada
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Confirmações ({details.length})
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {details.map((d) => (
                <div
                  key={d.id}
                  className="border rounded-md p-2 text-xs space-y-1"
                >
                  <div className="font-medium">{d.client_name}</div>
                  <div className="text-muted-foreground">
                    {format(new Date(d.confirmed_at), "dd/MM/yyyy HH:mm:ss", {
                      locale: ptBR,
                    })}
                  </div>
                  {d.ip_address && (
                    <div className="text-muted-foreground font-mono">
                      IP: {d.ip_address}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
