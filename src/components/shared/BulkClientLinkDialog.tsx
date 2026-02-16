import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Users, Link2 } from "lucide-react";
import { toast } from "sonner";

type EntityType = "processes" | "publication_terms" | "distribution_terms";

interface BulkClientLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  onSuccess?: () => void;
}

interface ClientOption {
  id: string;
  name: string;
}

interface UnlinkedItem {
  id: string;
  label: string;
  selected: boolean;
}

const entityConfig: Record<EntityType, {
  title: string;
  description: string;
  junctionTable: string;
  entityIdColumn: string;
  fetchQuery: () => Promise<UnlinkedItem[]>;
}> = {
  processes: {
    title: "Vincular Clientes a Processos",
    description: "Selecione os clientes e processos para vincular em lote",
    junctionTable: "client_processes",
    entityIdColumn: "process_id",
    fetchQuery: async () => {
      const { data } = await supabase
        .from("processes")
        .select("id, process_number, client_processes(id)")
        .order("process_number");
      return (data || []).map((p: any) => ({
        id: p.id,
        label: p.process_number,
        selected: !p.client_processes || p.client_processes.length === 0,
      }));
    },
  },
  publication_terms: {
    title: "Vincular Clientes a Termos de Publicação",
    description: "Selecione os clientes e termos para vincular em lote",
    junctionTable: "client_search_terms",
    entityIdColumn: "search_term_id",
    fetchQuery: async () => {
      const { data } = await supabase
        .from("search_terms")
        .select("id, term, term_type, client_search_terms(id)")
        .in("term_type", ["name", "office"])
        .order("term");
      return (data || []).map((t: any) => ({
        id: t.id,
        label: `${t.term} (${t.term_type === "office" ? "Escritório" : "Nome"})`,
        selected: !t.client_search_terms || t.client_search_terms.length === 0,
      }));
    },
  },
  distribution_terms: {
    title: "Vincular Clientes a Nomes de Distribuição",
    description: "Selecione os clientes e nomes para vincular em lote",
    junctionTable: "client_search_terms",
    entityIdColumn: "search_term_id",
    fetchQuery: async () => {
      const { data } = await supabase
        .from("search_terms")
        .select("id, term, client_search_terms(id)")
        .eq("term_type", "distribution")
        .order("term");
      return (data || []).map((t: any) => ({
        id: t.id,
        label: t.term,
        selected: !t.client_search_terms || t.client_search_terms.length === 0,
      }));
    },
  },
};

export function BulkClientLinkDialog({ open, onOpenChange, entityType, onSuccess }: BulkClientLinkDialogProps) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [items, setItems] = useState<UnlinkedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const config = entityConfig[entityType];

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, entityType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsRes, itemsRes] = await Promise.all([
        supabase.from("client_systems").select("id, name").eq("is_active", true).order("name"),
        config.fetchQuery(),
      ]);
      setClients(clientsRes.data || []);
      setItems(itemsRes);
      setSelectedClients([]);
      setSelectAll(false);
    } catch (e) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const toggleClient = (id: string) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setItems((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const selectedItems = items.filter((i) => i.selected);

  const handleSave = async () => {
    if (selectedClients.length === 0) {
      toast.error("Selecione ao menos um cliente");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Selecione ao menos um item");
      return;
    }

    setSaving(true);
    try {
      // Build all link records
      const records = selectedClients.flatMap((clientId) =>
        selectedItems.map((item) => ({
          client_system_id: clientId,
          [config.entityIdColumn]: item.id,
        }))
      );

      // Use upsert-like approach: for each item+client, check if exists
      // We'll insert with onConflict ignore by catching errors
      const { error } = await supabase
        .from(config.junctionTable as any)
        .upsert(records as any, { onConflict: `client_system_id,${config.entityIdColumn}`, ignoreDuplicates: true });

      if (error) throw error;

      toast.success(`${selectedItems.length} itens vinculados a ${selectedClients.length} cliente(s)`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Bulk link error:", error);
      toast.error("Erro ao vincular: " + (error.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Clients */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Clientes
                {selectedClients.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{selectedClients.length}</Badge>
                )}
              </Label>
              <ScrollArea className="h-[300px] border rounded-md p-3">
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div key={client.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`bulk-client-${client.id}`}
                        checked={selectedClients.includes(client.id)}
                        onCheckedChange={() => toggleClient(client.id)}
                      />
                      <label htmlFor={`bulk-client-${client.id}`} className="text-sm cursor-pointer">
                        {client.name}
                      </label>
                    </div>
                  ))}
                  {clients.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum cliente ativo</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Itens
                  {selectedItems.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{selectedItems.length}/{items.length}</Badge>
                  )}
                </Label>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="select-all"
                    checked={selectAll}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                  <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                    Todos
                  </label>
                </div>
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-3">
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`bulk-item-${item.id}`}
                        checked={item.selected}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <label htmlFor={`bulk-item-${item.id}`} className="text-sm cursor-pointer truncate">
                        {item.label}
                      </label>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            {selectedItems.length > 0 && selectedClients.length > 0 && (
              <span>{selectedItems.length} × {selectedClients.length} = {selectedItems.length * selectedClients.length} vínculos</span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || selectedClients.length === 0 || selectedItems.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
