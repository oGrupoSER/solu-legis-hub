import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PartnerService {
  id: string;
  service_name: string;
  office_code: number | null;
}

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function ProcessDialog({ open, onOpenChange, onSuccess }: ProcessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<PartnerService[]>([]);
  const [formData, setFormData] = useState({
    processNumber: "",
    serviceId: "",
    officeCode: "",
    uf: "",
    instance: "1",
  });

  useEffect(() => {
    if (open) {
      fetchServices();
    }
  }, [open]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("partner_services")
        .select("id, service_name, office_code")
        .eq("service_type", "processes")
        .eq("is_active", true);

      if (error) throw error;
      setServices(data || []);

      if (data && data.length === 1) {
        setFormData(prev => ({
          ...prev,
          serviceId: data[0].id,
          officeCode: data[0].office_code?.toString() || "",
        }));
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setFormData(prev => ({
      ...prev,
      serviceId,
      officeCode: service?.office_code?.toString() || prev.officeCode,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.processNumber || !formData.officeCode) {
      toast.error("Número do processo e código do escritório são obrigatórios");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("sync-process-management", {
        body: {
          action: "register",
          serviceId: formData.serviceId || undefined,
          processNumber: formData.processNumber.trim(),
          officeCode: parseInt(formData.officeCode),
          uf: formData.uf || undefined,
          instance: parseInt(formData.instance) || 0,
        },
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || "Erro ao cadastrar processo");
      }

      onSuccess();
    } catch (error) {
      console.error("Error registering process:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao cadastrar processo");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      processNumber: "",
      serviceId: services.length === 1 ? services[0].id : "",
      officeCode: services.length === 1 ? services[0].office_code?.toString() || "" : "",
      uf: "",
      instance: "1",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Processo</DialogTitle>
            <DialogDescription>
              Adicione um processo para monitoramento pela Solucionare
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="processNumber">Número do Processo *</Label>
              <Input
                id="processNumber"
                placeholder="0000000-00.0000.0.00.0000"
                value={formData.processNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, processNumber: e.target.value }))}
                required
              />
            </div>

            {services.length > 1 && (
              <div className="grid gap-2">
                <Label htmlFor="service">Serviço</Label>
                <Select
                  value={formData.serviceId}
                  onValueChange={handleServiceChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.service_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="officeCode">Código do Escritório *</Label>
                <Input
                  id="officeCode"
                  type="number"
                  placeholder="Ex: 12345"
                  value={formData.officeCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, officeCode: e.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uf">UF</Label>
                <Select
                  value={formData.uf}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, uf: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="instance">Instância</Label>
              <Select
                value={formData.instance}
                onValueChange={(value) => setFormData(prev => ({ ...prev, instance: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Todas</SelectItem>
                  <SelectItem value="1">1ª Instância</SelectItem>
                  <SelectItem value="2">2ª Instância</SelectItem>
                  <SelectItem value="3">Instâncias Superiores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar Processo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
