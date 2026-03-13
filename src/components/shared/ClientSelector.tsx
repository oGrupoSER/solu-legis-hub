import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Users } from "lucide-react";

interface ClientSelectorProps {
  /** Filter clients by those entitled to this service */
  serviceId?: string;
  /** Currently selected client IDs */
  selectedIds: string[];
  /** Callback when selection changes */
  onChange: (ids: string[]) => void;
  /** Show validation error state */
  error?: boolean;
  /** Auto-select client names matching these (case-insensitive) */
  autoSelectNames?: string[];
}

interface ClientOption {
  id: string;
  name: string;
}

export function ClientSelector({ serviceId, selectedIds, onChange, error, autoSelectNames = ["infojudiciais"] }: ClientSelectorProps) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);

  useEffect(() => {
    fetchClients();
    setAutoSelected(false);
  }, [serviceId]);

  // Auto-select after clients are loaded (only once)
  useEffect(() => {
    if (!autoSelected && clients.length > 0 && selectedIds.length === 0 && autoSelectNames.length > 0) {
      const lowerNames = autoSelectNames.map(n => n.toLowerCase());
      const matchIds = clients
        .filter(c => lowerNames.some(n => c.name.toLowerCase().includes(n)))
        .map(c => c.id);
      if (matchIds.length > 0) {
        onChange(matchIds);
      }
      setAutoSelected(true);
    }
  }, [clients, autoSelected]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      if (serviceId) {
        const { data } = await supabase
          .from("client_system_services")
          .select("client_systems(id, name)")
          .eq("partner_service_id", serviceId)
          .eq("is_active", true);

        const result = (data || [])
          .map((item: any) => item.client_systems)
          .filter(Boolean)
          .sort((a: ClientOption, b: ClientOption) => prioritySort(a.name, b.name));
        setClients(result);
      } else {
        const { data } = await supabase
          .from("client_systems")
          .select("id, name")
          .eq("is_active", true)
          .order("name");
        const sorted = (data || []).sort((a, b) => prioritySort(a.name, b.name));
        setClients(sorted);
      }
    } catch (e) {
      console.error("Error fetching clients:", e);
    } finally {
      setLoading(false);
    }
  };

  /** Sort with "Infojudiciais" always first */
  const prioritySort = (a: string, b: string): number => {
    const aIsInfo = a.toLowerCase().includes("infojudiciais");
    const bIsInfo = b.toLowerCase().includes("infojudiciais");
    if (aIsInfo && !bIsInfo) return -1;
    if (!aIsInfo && bIsInfo) return 1;
    return a.localeCompare(b);
  };

  const handleToggle = (clientId: string) => {
    if (selectedIds.includes(clientId)) {
      onChange(selectedIds.filter((id) => id !== clientId));
    } else {
      onChange([...selectedIds, clientId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando clientes...
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        {serviceId
          ? "Nenhum cliente habilitado para este serviço."
          : "Nenhum cliente cadastrado."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Users className="h-4 w-4" />
        Clientes *
      </Label>
      <div
        className={`border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto ${
          error ? "border-destructive" : ""
        }`}
      >
        {clients.map((client) => (
          <div key={client.id} className="flex items-center gap-2">
            <Checkbox
              id={`client-${client.id}`}
              checked={selectedIds.includes(client.id)}
              onCheckedChange={() => handleToggle(client.id)}
            />
            <label
              htmlFor={`client-${client.id}`}
              className="text-sm font-medium cursor-pointer leading-none"
            >
              {client.name}
            </label>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-xs text-destructive">Selecione ao menos um cliente</p>
      )}
    </div>
  );
}
