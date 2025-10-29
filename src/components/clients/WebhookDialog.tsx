import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSystemId: string;
  webhook?: {
    id: string;
    webhook_url: string;
    events: string[];
    secret?: string;
  };
  onSuccess: () => void;
}

export function WebhookDialog({
  open,
  onOpenChange,
  clientSystemId,
  webhook,
  onSuccess,
}: WebhookDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(webhook?.webhook_url || "");
  const [secret, setSecret] = useState(webhook?.secret || "");
  const [events, setEvents] = useState<string[]>(webhook?.events || []);

  const availableEvents = [
    { value: "processes", label: "Processos" },
    { value: "distributions", label: "Distribuições" },
    { value: "publications", label: "Publicações" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (webhook) {
        const { error } = await supabase
          .from("client_webhooks")
          .update({
            webhook_url: webhookUrl,
            events,
            secret: secret || null,
          })
          .eq("id", webhook.id);

        if (error) throw error;
        toast({ title: "Webhook atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("client_webhooks").insert({
          client_system_id: clientSystemId,
          webhook_url: webhookUrl,
          events,
          secret: secret || null,
        });

        if (error) throw error;
        toast({ title: "Webhook criado com sucesso!" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar webhook",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {webhook ? "Editar Webhook" : "Adicionar Webhook"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook_url">URL do Webhook</Label>
            <Input
              id="webhook_url"
              type="url"
              placeholder="https://exemplo.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret">Secret (Opcional)</Label>
            <Input
              id="secret"
              type="password"
              placeholder="Secret para assinatura HMAC"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usado para assinar o payload com HMAC SHA256
            </p>
          </div>

          <div className="space-y-2">
            <Label>Eventos</Label>
            <div className="space-y-2">
              {availableEvents.map((event) => (
                <div key={event.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={event.value}
                    checked={events.includes(event.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setEvents([...events, event.value]);
                      } else {
                        setEvents(events.filter((e) => e !== event.value));
                      }
                    }}
                  />
                  <label
                    htmlFor={event.value}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {event.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || events.length === 0}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
