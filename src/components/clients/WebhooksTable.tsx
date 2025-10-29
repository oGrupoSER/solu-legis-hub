import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WebhookDialog } from "./WebhookDialog";

interface WebhooksTableProps {
  clientSystemId: string;
}

export function WebhooksTable({ clientSystemId }: WebhooksTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["client-webhooks", clientSystemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_webhooks")
        .select("*")
        .eq("client_system_id", clientSystemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (webhook: any) => {
    setSelectedWebhook(webhook);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este webhook?")) return;

    try {
      const { error } = await supabase
        .from("client_webhooks")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Webhook excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["client-webhooks", clientSystemId] });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir webhook",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("client_webhooks")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;

      toast({ title: `Webhook ${!isActive ? "ativado" : "desativado"} com sucesso!` });
      queryClient.invalidateQueries({ queryKey: ["client-webhooks", clientSystemId] });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar webhook",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Carregando webhooks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Webhooks</h3>
        <Button
          onClick={() => {
            setSelectedWebhook(null);
            setDialogOpen(true);
          }}
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Webhook
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>URL</TableHead>
            <TableHead>Eventos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {webhooks && webhooks.length > 0 ? (
            webhooks.map((webhook) => (
              <TableRow key={webhook.id}>
                <TableCell className="font-mono text-sm">
                  {webhook.webhook_url}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {webhook.events.map((event: string) => (
                      <Badge key={event} variant="secondary">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={webhook.is_active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => handleToggleActive(webhook.id, webhook.is_active)}
                  >
                    {webhook.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(webhook)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(webhook.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum webhook cadastrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <WebhookDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientSystemId={clientSystemId}
        webhook={selectedWebhook}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["client-webhooks", clientSystemId] });
        }}
      />
    </div>
  );
}
