import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { ClientSelector } from "@/components/shared/ClientSelector";

const CNJ_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

function formatCNJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 20);
  let formatted = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 7) formatted += "-";
    if (i === 9 || i === 13) formatted += ".";
    if (i === 14 || i === 16) formatted += ".";
    formatted += digits[i];
  }
  return formatted;
}

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

export function ProcessDialog({ open, onOpenChange, onSuccess }: ProcessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<PartnerService[]>([]);
  const [partnerOfficeCode, setPartnerOfficeCode] = useState<number | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientError, setClientError] = useState(false);
  const [formData, setFormData] = useState({
    processNumber: "",
    serviceId: "",
  });

  useEffect(() => {
    if (open) {
      fetchServices();
      setDuplicateInfo(null);
    }
  }, [open]);

  useEffect(() => {
    if (formData.serviceId) {
      fetchPartnerOfficeCode(formData.serviceId);
    } else {
      setPartnerOfficeCode(null);
    }
  }, [formData.serviceId]);

  useEffect(() => {
    const checkDuplicate = async () => {
      const pn = formData.processNumber.trim();
      if (pn.length < 10) { setDuplicateInfo(null); return; }
      const { data } = await supabase
        .from("processes")
        .select("id, process_number, instance, client_processes(client_systems(name))")
        .eq("process_number", pn);

      if (data && data.length > 0) {
        const clients = [...new Set(
          data.flatMap((p: any) =>
            p.client_processes?.map((cp: any) => cp.client_systems?.name).filter(Boolean) || []
          )
        )];
        const instances = data.map((p: any) => p.instance).filter(Boolean);
        setDuplicateInfo(
          clients.length > 0
            ? `Processo já monitorado nas instâncias ${instances.join(", ")} (clientes: ${clients.join(", ")}). Será apenas vinculado ao(s) novo(s) cliente(s).`
            : `Processo já existe no sistema (instâncias ${instances.join(", ")}). Será apenas vinculado ao(s) novo(s) cliente(s).`
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

  const fetchPartnerOfficeCode = async (serviceId: string) => {
    const { data } = await supabase
      .from("partner_services")
      .select("partners(office_code)")
      .eq("id", serviceId)
      .single();
    const oc = (data?.partners as any)?.office_code as number | null;
    setPartnerOfficeCode(oc);
  };

  const validate = (): boolean => {
    if (!formData.processNumber.trim()) {
      toast.error("Número do processo é obrigatório");
      return false;
    }
    if (!CNJ_REGEX.test(formData.processNumber.trim())) {
      toast.error("Formato CNJ inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO");
      return false;
    }
    if (selectedClients.length === 0) {
      setClientError(true);
      toast.error("Selecione ao menos um cliente");
      return false;
    }
    if (!partnerOfficeCode) {
      toast.error("Parceiro não possui código de escritório configurado");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      for (const clientId of selectedClients) {
        const { data, error } = await supabase.functions.invoke("sync-process-management", {
          body: {
            action: "register",
            serviceId: formData.serviceId || undefined,
            processNumber: formData.processNumber.trim(),
            clientSystemId: clientId,
          },
        });

        if (error) {
          const errStr = error.message || String(error);
          const jsonMatch = errStr.match(/\{.*"error"\s*:\s*"([^"]+)".*\}/);
          throw new Error(jsonMatch?.[1] || errStr);
        }
        if (!data?.success) throw new Error(data?.error || "Erro ao cadastrar processo");
      }

      toast.success(
        selectedClients.length > 1
          ? `Processo vinculado a ${selectedClients.length} clientes`
          : "Processo cadastrado com sucesso"
      );
      onSuccess();
    } catch (error) {
      console.error("Error registering process:", error);
      const msg = error instanceof Error ? error.message : "Erro ao cadastrar processo";
      if (msg.includes("já cadastrado") || msg.includes("already")) {
        toast.error("Este processo já está cadastrado no parceiro.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      processNumber: "",
      serviceId: services.length === 1 ? services[0].id : "",
    });
    setSelectedClients([]);
    setClientError(false);
    setDuplicateInfo(null);
    setPartnerOfficeCode(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[520px]">
        {loading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-lg gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-medium">Cadastrando nas 3 instâncias...</p>
          </div>
        )}

        <DialogHeader>
          <DialogTitle>Cadastrar Novo Processo</DialogTitle>
          <DialogDescription>
            Adicione um processo CNJ para monitoramento de andamentos.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            O processo será cadastrado e monitorado automaticamente nas 3 instâncias (1ª, 2ª e Superiores), caso encontrado.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="processNumber">Número do Processo (CNJ) *</Label>
            <Input
              id="processNumber"
              placeholder="0000000-00.0000.0.00.0000"
              value={formData.processNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, processNumber: formatCNJ(e.target.value) }))}
              disabled={loading}
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
              <Label>Serviço</Label>
              <Select value={formData.serviceId} onValueChange={(v) => setFormData(prev => ({ ...prev, serviceId: v }))} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ClientSelector
            serviceId={formData.serviceId || undefined}
            selectedIds={selectedClients}
            onChange={(ids) => { setSelectedClients(ids); setClientError(false); }}
            error={clientError}
          />

          {partnerOfficeCode && (
            <div className="grid gap-2">
              <Label>Código do Escritório (Parceiro)</Label>
              <Input value={partnerOfficeCode.toString()} disabled className="bg-muted" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar Processo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
