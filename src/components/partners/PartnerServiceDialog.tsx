import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PartnerService {
  id: string;
  partner_id: string;
  service_name: string;
  service_type: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  is_active: boolean;
  config: Record<string, any>;
}

interface PartnerServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  service?: PartnerService;
}

const PartnerServiceDialog = ({ open, onOpenChange, partnerId, service }: PartnerServiceDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    service_name: "",
    service_type: "",
    service_url: "",
    nome_relacional: "",
    token: "",
    is_active: true,
    config: "{}"
  });

  useEffect(() => {
    if (service) {
      setFormData({
        service_name: service.service_name,
        service_type: service.service_type,
        service_url: service.service_url,
        nome_relacional: service.nome_relacional,
        token: service.token,
        is_active: service.is_active,
        config: JSON.stringify(service.config, null, 2)
      });
    } else {
      setFormData({
        service_name: "",
        service_type: "",
        service_url: "",
        nome_relacional: "",
        token: "",
        is_active: true,
        config: "{}"
      });
    }
  }, [service, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let configJson;
      try {
        configJson = JSON.parse(formData.config);
      } catch {
        toast({
          title: "Erro de Validação",
          description: "A configuração JSON não é válida",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const serviceData = {
        partner_id: partnerId,
        service_name: formData.service_name,
        service_type: formData.service_type,
        service_url: formData.service_url,
        nome_relacional: formData.nome_relacional,
        token: formData.token,
        is_active: formData.is_active,
        config: configJson
      };

      if (service) {
        const { error } = await supabase
          .from("partner_services")
          .update(serviceData)
          .eq("id", service.id);

        if (error) throw error;

        toast({
          title: "Serviço atualizado",
          description: "O serviço foi atualizado com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("partner_services")
          .insert([serviceData]);

        if (error) throw error;

        toast({
          title: "Serviço criado",
          description: "O serviço foi criado com sucesso",
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Erro ao salvar serviço",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_name">Nome do Serviço</Label>
            <Input
              id="service_name"
              value={formData.service_name}
              onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              placeholder="Ex: Andamentos Processuais - API V3"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service_type">Tipo de Serviço</Label>
            <Select
              value={formData.service_type}
              onValueChange={(value) => setFormData({ ...formData, service_type: value })}
              required
            >
              <SelectTrigger id="service_type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="processes">Andamentos</SelectItem>
                <SelectItem value="distributions">Distribuições</SelectItem>
                <SelectItem value="publications">Publicações</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service_url">URL do Serviço</Label>
            <Input
              id="service_url"
              type="url"
              value={formData.service_url}
              onChange={(e) => setFormData({ ...formData, service_url: e.target.value })}
              placeholder="http://api.example.com/endpoint"
              required
            />
            <p className="text-sm text-muted-foreground">
              ⚠️ Insira apenas a URL base do serviço, <strong>sem parâmetros</strong> (?, &amp;).
              {formData.service_type === 'publications' && (
                <> Para Publicações REST, exemplo: <code className="text-xs bg-muted px-1 rounded">http://domain/api/endpoint</code></>
              )}
            </p>
            {(formData.service_url.includes('?') || formData.service_url.includes('&')) && (
              <p className="text-sm text-destructive">
                ⛔ A URL não deve conter parâmetros (? ou &amp;). Os campos "Nome Relacional" e "Token" serão adicionados automaticamente.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome_relacional">Nome Relacional</Label>
            <Input
              id="nome_relacional"
              value={formData.nome_relacional}
              onChange={(e) => setFormData({ ...formData, nome_relacional: e.target.value })}
              placeholder="Nome do cliente/escritório"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Token de Acesso</Label>
            <Input
              id="token"
              type="password"
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              placeholder="Token de autenticação"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="config">Configurações Adicionais (JSON)</Label>
            <Textarea
              id="config"
              value={formData.config}
              onChange={(e) => setFormData({ ...formData, config: e.target.value })}
              placeholder='{"key": "value"}'
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Configurações específicas do serviço em formato JSON
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Serviço Ativo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PartnerServiceDialog;
