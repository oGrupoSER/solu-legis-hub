import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Key, Webhook, Settings2, Users } from "lucide-react";
import { toast } from "sonner";
import { ClientSystemDialog } from "@/components/clients/ClientSystemDialog";
import { TokensDialog } from "@/components/clients/TokensDialog";
import { WebhooksTable } from "@/components/clients/WebhooksTable";
import { ClientServicesDialog } from "@/components/clients/ClientServicesDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ClientSystem {
  id: string;
  name: string;
  description: string | null;
  contact_email: string | null;
  office_code: number | null;
  is_active: boolean;
  created_at: string;
  services_count?: number;
}

const Clients = () => {
  const [clients, setClients] = useState<ClientSystem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientSystem | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [tokensDialogOpen, setTokensDialogOpen] = useState(false);
  const [webhooksDialogOpen, setWebhooksDialogOpen] = useState(false);
  const [servicesDialogOpen, setServicesDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string>("");

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data: clientsData, error } = await supabase
        .from("client_systems")
        .select("*")
        .order("name");

      if (error) throw error;

      // Get service counts for each client
      const clientsWithCounts = await Promise.all(
        (clientsData || []).map(async (client) => {
          const { count } = await supabase
            .from("client_system_services")
            .select("*", { count: "exact", head: true })
            .eq("client_system_id", client.id)
            .eq("is_active", true);
          return { ...client, services_count: count || 0 };
        })
      );

      setClients(clientsWithCounts);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar sistemas clientes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (client: ClientSystem) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("client_systems")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Sistema cliente excluído com sucesso");
      fetchClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Erro ao excluir sistema cliente");
    }
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingClient(undefined);
    if (refresh) fetchClients();
  };

  const handleManageTokens = (clientId: string) => {
    setSelectedClientId(clientId);
    setTokensDialogOpen(true);
  };

  const handleManageWebhooks = (clientId: string) => {
    setSelectedClientId(clientId);
    setWebhooksDialogOpen(true);
  };

  const handleManageServices = (client: ClientSystem) => {
    setSelectedClientId(client.id);
    setSelectedClientName(client.name);
    setServicesDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex justify-center p-8">Carregando sistemas clientes...</div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Sistemas Clientes</CardTitle>
                <CardDescription>
                  Gerencie os sistemas que consomem a API do Hub Jurídico
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum sistema cliente cadastrado. Clique em "Novo Cliente" para adicionar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail de Contato</TableHead>
                  <TableHead>Cód. Escritório</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.contact_email || "-"}</TableCell>
                    <TableCell>{client.office_code || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {client.services_count} serviço(s)
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.is_active ? "default" : "secondary"}>
                        {client.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(client.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleManageServices(client)}
                          title="Gerenciar Serviços"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleManageTokens(client.id)}
                          title="Gerenciar Tokens"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleManageWebhooks(client.id)}
                          title="Gerenciar Webhooks"
                        >
                          <Webhook className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(client)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setClientToDelete(client.id);
                            setDeleteDialogOpen(true);
                          }}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ClientSystemDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        system={editingClient}
      />

      {selectedClientId && (
        <>
          <TokensDialog
            open={tokensDialogOpen}
            onOpenChange={setTokensDialogOpen}
            systemId={selectedClientId}
          />

          <Dialog open={webhooksDialogOpen} onOpenChange={setWebhooksDialogOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Gerenciar Webhooks</DialogTitle>
              </DialogHeader>
              <WebhooksTable clientSystemId={selectedClientId} />
            </DialogContent>
          </Dialog>

          <ClientServicesDialog
            open={servicesDialogOpen}
            onOpenChange={setServicesDialogOpen}
            clientSystemId={selectedClientId}
            clientName={selectedClientName}
            onUpdate={fetchClients}
          />
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este sistema cliente? Todos os tokens e webhooks associados também serão excluídos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (clientToDelete) {
                  handleDelete(clientToDelete);
                  setDeleteDialogOpen(false);
                  setClientToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clients;
