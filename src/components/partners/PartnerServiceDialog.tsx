import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Info, Eye, EyeOff } from "lucide-react";

interface PartnerService {
  id: string;
  partner_id: string;
  service_name: string;
  service_type: string;
  service_url: string;
  nome_relacional: string;
  token: string;
  is_active: boolean;
  confirm_receipt: boolean;
  config: Record<string, any>;
}

interface PartnerServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  service?: PartnerService;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  processes: "Andamentos",
  distributions: "Distribuições",
  publications: "Publicações",
  terms: "Termos e Escritórios",
  diary_status: "Status dos Diários",
};

const getConfigHelp = (serviceType: string): { example: string; description: string } | null => {
  if (serviceType === "diary_status") {
    return {
      example: '{ "tipoDataFiltro": 1 }',
      description: 'O campo "tipoDataFiltro" define como filtrar a data na consulta. Valores: 1 = Data de publicação, 2 = Data de disponibilização. A data é calculada automaticamente (data atual) a cada sincronização.',
    };
  }
  return null;
};

const PartnerServiceDialog = ({ open, onOpenChange, partnerId, service }: PartnerServiceDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [formData, setFormData] = useState({
    service_name: "",
    service_type: "",
    service_url: "",
    nome_relacional: "",
    token: "",
    is_active: true,
    confirm_receipt: false,
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
        confirm_receipt: service.confirm_receipt ?? false,
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
        confirm_receipt: false,
        config: "{}"
      });
    }
  }, [service, open]);

  // Auto-fill config when selecting diary_status type
  useEffect(() => {
    if (formData.service_type === "diary_status" && formData.config === "{}") {
      setFormData(prev => ({
        ...prev,
        config: '{\n  "tipoDataFiltro": 1\n}'
      }));
    }
  }, [formData.service_type]);

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
        confirm_receipt: formData.confirm_receipt,
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

  const configHelp = getConfigHelp(formData.service_type);

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
                <SelectItem value="terms">Termos e Escritórios</SelectItem>
                <SelectItem value="diary_status">Status dos Diários</SelectItem>
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
              {formData.service_type === 'terms' && (
                <> Para Termos SOAP, exemplo: <code className="text-xs bg-muted px-1 rounded">http://domain/webservice/NomeService.wsdl</code></>
              )}
              {formData.service_type === 'diary_status' && (
                <> Para Status dos Diários, exemplo: <code className="text-xs bg-muted px-1 rounded">http://domain/api/ControllerApi/Publicacoes/statusDiarios</code></>
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
            <div className="relative">
              <Input
                id="token"
                type={showToken ? "text" : "password"}
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                placeholder="Token de autenticação"
                required
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
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
            {configHelp ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <p className="text-sm mb-2">{configHelp.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Exemplo: <code className="bg-muted px-1 rounded">{configHelp.example.replace(/\n/g, ' ')}</code>
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                Configurações específicas do serviço em formato JSON
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Serviço Ativo</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="confirm_receipt"
              checked={formData.confirm_receipt}
              onCheckedChange={(checked) => setFormData({ ...formData, confirm_receipt: checked })}
            />
            <Label htmlFor="confirm_receipt" className="flex flex-col">
              <span>Confirmar Recebimento</span>
              <span className="text-xs text-muted-foreground font-normal">
                ⚠️ Manter desativado enquanto sistema legado estiver ativo
              </span>
            </Label>
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
