import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Key, Webhook } from "lucide-react";
import { toast } from "sonner";
import { ClientSystemDialog } from "./ClientSystemDialog";
import { TokensDialog } from "./TokensDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WebhooksTable } from "./WebhooksTable";

interface ClientSystem {
  id: string;
  name: string;
  description: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
}

export const ClientSystemsTable = () => {
  const [systems, setSystems] = useState<ClientSystem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tokensDialogOpen, setTokensDialogOpen] = useState(false);
  const [webhooksDialogOpen, setWebhooksDialogOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<ClientSystem | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  const fetchSystems = async () => {
    try {
      const { data, error } = await supabase
        .from("client_systems")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSystems(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar sistemas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystems();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este sistema?")) return;

    try {
      const { error } = await supabase.from("client_systems").delete().eq("id", id);
      if (error) throw error;
      toast.success("Sistema excluído com sucesso");
      fetchSystems();
    } catch (error: any) {
      toast.error("Erro ao excluir sistema");
    }
  };

  const handleEdit = (system: ClientSystem) => {
    setEditingSystem(system);
    setDialogOpen(true);
  };

  const handleManageTokens = (systemId: string) => {
    setSelectedSystemId(systemId);
    setTokensDialogOpen(true);
  };

  const handleManageWebhooks = (systemId: string) => {
    setSelectedSystemId(systemId);
    setWebhooksDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingSystem(null);
    if (refresh) fetchSystems();
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Sistemas Clientes</h2>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Sistema
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Email de Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {systems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum sistema cadastrado
                </TableCell>
              </TableRow>
            ) : (
              systems.map((system) => (
                <TableRow key={system.id}>
                  <TableCell className="font-medium">{system.name}</TableCell>
                  <TableCell className="text-muted-foreground">{system.description || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{system.contact_email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={system.is_active ? "default" : "secondary"}>
                      {system.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleManageTokens(system.id)}>
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleManageWebhooks(system.id)}>
                        <Webhook className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(system)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(system.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ClientSystemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        system={editingSystem}
      />

      <TokensDialog
        open={tokensDialogOpen}
        onOpenChange={() => setTokensDialogOpen(false)}
        systemId={selectedSystemId}
      />

      <Dialog open={webhooksDialogOpen} onOpenChange={setWebhooksDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Webhooks</DialogTitle>
          </DialogHeader>
          {selectedSystemId && <WebhooksTable clientSystemId={selectedSystemId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
