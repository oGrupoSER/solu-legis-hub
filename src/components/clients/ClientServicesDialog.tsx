import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface PartnerService {
  id: string;
  service_name: string;
  service_type: string;
  partner_name: string;
  is_enabled: boolean;
}

interface ClientServicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSystemId: string;
  clientName: string;
  onUpdate?: () => void;
}

export function ClientServicesDialog({
  open,
  onOpenChange,
  clientSystemId,
  clientName,
  onUpdate,
}: ClientServicesDialogProps) {
  const [services, setServices] = useState<PartnerService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && clientSystemId) {
      fetchServices();
    }
  }, [open, clientSystemId]);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      // Get all partner services with partner info
      const { data: allServices, error: servicesError } = await supabase
        .from("partner_services")
        .select(`
          id,
          service_name,
          service_type,
          partners!inner(name)
        `)
        .eq("is_active", true)
        .order("service_name");

      if (servicesError) throw servicesError;

      // Get enabled services for this client
      const { data: enabledServices, error: enabledError } = await supabase
        .from("client_system_services")
        .select("partner_service_id")
        .eq("client_system_id", clientSystemId)
        .eq("is_active", true);

      if (enabledError) throw enabledError;

      const enabledSet = new Set(enabledServices?.map((s) => s.partner_service_id) || []);
      setSelectedServices(enabledSet);

      const formattedServices = (allServices || []).map((service: any) => ({
        id: service.id,
        service_name: service.service_name,
        service_type: service.service_type,
        partner_name: service.partners?.name || "Desconhecido",
        is_enabled: enabledSet.has(service.id),
      }));

      setServices(formattedServices);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    setSelectedServices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Delete all existing links for this client
      const { error: deleteError } = await supabase
        .from("client_system_services")
        .delete()
        .eq("client_system_id", clientSystemId);

      if (deleteError) throw deleteError;

      // Insert new links
      if (selectedServices.size > 0) {
        const newLinks = Array.from(selectedServices).map((serviceId) => ({
          client_system_id: clientSystemId,
          partner_service_id: serviceId,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from("client_system_services")
          .insert(newLinks);

        if (insertError) throw insertError;
      }

      toast.success("Serviços atualizados com sucesso");
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving services:", error);
      toast.error("Erro ao salvar serviços");
    } finally {
      setIsSaving(false);
    }
  };

  const getServiceTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      processes: "Andamentos",
      distributions: "Distribuições",
      publications: "Publicações",
      terms: "Termos",
      court_news: "Notícias",
    };
    return types[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Serviços Habilitados</DialogTitle>
          <DialogDescription>
            Selecione os serviços que "{clientName}" pode acessar
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum serviço disponível. Cadastre serviços nos parceiros primeiro.
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={service.id}
                    checked={selectedServices.has(service.id)}
                    onCheckedChange={() => handleToggleService(service.id)}
                  />
                  <div>
                    <label
                      htmlFor={service.id}
                      className="font-medium cursor-pointer"
                    >
                      {service.service_name}
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {service.partner_name}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">
                  {getServiceTypeLabel(service.service_type)}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedServices.size} serviço(s) selecionado(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
