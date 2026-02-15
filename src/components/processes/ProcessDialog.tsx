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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface ProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PartnerService {
  id: string;
  service_name: string;
  partner_id: string;
}

interface ClientSystem {
  id: string;
  name: string;
}

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function ProcessDialog({ open, onOpenChange, onSuccess }: ProcessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<PartnerService[]>([]);
  const [clientSystems, setClientSystems] = useState<ClientSystem[]>([]);
  const [partnerOfficeCode, setPartnerOfficeCode] = useState<number | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    processNumber: "",
    serviceId: "",
    clientSystemId: "",
    uf: "",
    instance: "1",
  });

  useEffect(() => {
    if (open) {
      fetchServices();
      setDuplicateInfo(null);
    }
  }, [open]);

  useEffect(() => {
    if (formData.serviceId) {
      fetchClientSystems(formData.serviceId);
      fetchPartnerOfficeCode(formData.serviceId);
    } else {
      setClientSystems([]);
      setPartnerOfficeCode(null);
    }
  }, [formData.serviceId]);

  // Check for duplicate when process number changes
  useEffect(() => {
    const checkDuplicate = async () => {
      const pn = formData.processNumber.trim();
      if (pn.length < 10) {
        setDuplicateInfo(null);
        return;
      }
      const { data } = await supabase
        .from("processes")
        .select("id, process_number, client_processes(client_systems(name))")
        .eq("process_number", pn)
        .maybeSingle();

      if (data) {
        const clients = (data as any).client_processes
          ?.map((cp: any) => cp.client_systems?.name)
          .filter(Boolean) || [];
        setDuplicateInfo(
          clients.length > 0
            ? `Processo já monitorado (clientes: ${clients.join(", ")}). Será apenas vinculado ao novo cliente.`
            : "Processo já existe no sistema. Será apenas vinculado ao novo cliente."
        );
      } else {
        setDuplicateInfo(null);
      }
    };

    const timeout = setTimeout(checkDuplicate, 500);
    return () => clearTimeout(timeout);
  }, [formData.processNumber]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from("partner_services")
      .select("id, service_name, partner_id")
      .eq("service_type", "processes")
      .eq("is_active", true);

    if (error) return;
    setServices(data || []);
    if (data && data.length === 1) {
      setFormData(prev => ({ ...prev, serviceId: data[0].id }));
    }
  };

  const fetchClientSystems = async (serviceId: string) => {
    const { data, error } = await supabase
      .from("client_system_services")
      .select("client_systems(id, name)")
      .eq("partner_service_id", serviceId)
      .eq("is_active", true);

    if (error) return;
    const clients = (data || [])
      .map((item: any) => item.client_systems)
      .filter(Boolean);

    setClientSystems(clients);
    if (clients.length === 1) {
      setFormData(prev => ({ ...prev, clientSystemId: clients[0].id }));
    }
  };

  const fetchPartnerOfficeCode = async (serviceId: string) => {
    const { data } = await supabase
      .from("partner_services")
      .select("partners(office_code)")
      .eq("id", serviceId)
      .single();

    const oc = (data?.partners as any)?.office_code as number | null;
    setPartnerOfficeCode(oc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.processNumber.trim()) {
      toast.error("Número do processo é obrigatório");
      return;
    }

    if (!partnerOfficeCode) {
      toast.error("Parceiro não possui código de escritório configurado");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("sync-process-management", {
        body: {
          action: "register",
          serviceId: formData.serviceId || undefined,
          processNumber: formData.processNumber.trim(),
          clientSystemId: formData.clientSystemId || undefined,
          uf: formData.uf || undefined,
          instance: parseInt(formData.instance) || 0,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao cadastrar processo");

      if (data.registeredInSolucionare) {
        toast.success("Processo registrado com sucesso na Solucionare");
      } else {
        toast.success("Processo vinculado ao cliente (já existia no sistema)");
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
      clientSystemId: "",
      uf: "",
      instance: "1",
    });
    setClientSystems([]);
    setDuplicateInfo(null);
    setPartnerOfficeCode(null);
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
              Adicione um processo para monitoramento. O sistema verificará automaticamente se o processo já existe.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="processNumber">Número do Processo (CNJ) *</Label>
              <Input
                id="processNumber"
                placeholder="0000000-00.0000.0.00.0000"
                value={formData.processNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, processNumber: e.target.value }))}
                required
              />
            </div>

            {duplicateInfo && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{duplicateInfo}</AlertDescription>
              </Alert>
            )}

            {services.length > 1 && (
              <div className="grid gap-2">
                <Label htmlFor="service">Serviço</Label>
                <Select
                  value={formData.serviceId}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, serviceId: v, clientSystemId: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {clientSystems.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="clientSystem">Sistema Cliente *</Label>
                <Select
                  value={formData.clientSystemId}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, clientSystemId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um sistema cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientSystems.map((cs) => (
                      <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {partnerOfficeCode && (
              <div className="grid gap-2">
                <Label>Código do Escritório (Parceiro)</Label>
                <Input value={partnerOfficeCode.toString()} disabled />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="uf">UF</Label>
                <Select
                  value={formData.uf}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, uf: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="instance">Instância</Label>
                <Select
                  value={formData.instance}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, instance: v }))}
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
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
