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
import { Info, ChevronLeft, ChevronRight } from "lucide-react";
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

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO","TS"
];

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

const STEPS = [
  { label: "Dados Básicos", number: 1 },
  { label: "Localização", number: 2 },
  { label: "Partes", number: 3 },
];

export function ProcessDialog({ open, onOpenChange, onSuccess }: ProcessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<PartnerService[]>([]);
  const [partnerOfficeCode, setPartnerOfficeCode] = useState<number | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientError, setClientError] = useState(false);
  const [formData, setFormData] = useState({
    processNumber: "",
    serviceId: "",
    uf: "",
    instance: "1",
    codTribunal: "",
    comarca: "",
    autor: "",
    reu: "",
  });

  useEffect(() => {
    if (open) {
      fetchServices();
      setDuplicateInfo(null);
      setStep(1);
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
        .select("id, process_number, client_processes(client_systems(name))")
        .eq("process_number", pn)
        .maybeSingle();

      if (data) {
        const clients = (data as any).client_processes
          ?.map((cp: any) => cp.client_systems?.name)
          .filter(Boolean) || [];
        setDuplicateInfo(
          clients.length > 0
            ? `Processo já monitorado (clientes: ${clients.join(", ")}). Será apenas vinculado ao(s) novo(s) cliente(s).`
            : "Processo já existe no sistema. Será apenas vinculado ao(s) novo(s) cliente(s)."
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

  const validateStep1 = (): boolean => {
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

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep1()) { setStep(1); return; }

    try {
      setLoading(true);

      for (const clientId of selectedClients) {
        const { data, error } = await supabase.functions.invoke("sync-process-management", {
          body: {
            action: "register",
            serviceId: formData.serviceId || undefined,
            processNumber: formData.processNumber.trim(),
            clientSystemId: clientId,
            uf: formData.uf || undefined,
            instance: parseInt(formData.instance) || 0,
            codTribunal: formData.codTribunal ? parseInt(formData.codTribunal) : undefined,
            comarca: formData.comarca || undefined,
            autor: formData.autor || undefined,
            reu: formData.reu || undefined,
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
      if (msg.includes("Instância informada inválida") || msg.includes("instância")) {
        toast.error("A instância selecionada não é aceita pelo parceiro. Selecione 1ª, 2ª ou Instâncias Superiores.");
      } else if (msg.includes("já cadastrado") || msg.includes("already")) {
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
      uf: "",
      instance: "1",
      codTribunal: "",
      comarca: "",
      autor: "",
      reu: "",
    });
    setSelectedClients([]);
    setClientError(false);
    setDuplicateInfo(null);
    setPartnerOfficeCode(null);
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Processo</DialogTitle>
          <DialogDescription>
            Adicione um processo para monitoramento de andamentos.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  step >= s.number
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}>
                  {s.number}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${step >= s.number ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > s.number ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="min-h-[280px]">
          {/* Step 1: Dados Básicos */}
          {step === 1 && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="processNumber">Número do Processo (CNJ) *</Label>
                <Input
                  id="processNumber"
                  placeholder="0000000-00.0000.0.00.0000"
                  value={formData.processNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, processNumber: formatCNJ(e.target.value) }))}
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
                  <Select value={formData.serviceId} onValueChange={(v) => setFormData(prev => ({ ...prev, serviceId: v }))}>
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
          )}

          {/* Step 2: Localização e Instância */}
          {step === 2 && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>UF</Label>
                  <Select value={formData.uf} onValueChange={(v) => setFormData(prev => ({ ...prev, uf: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf === "TS" ? "TS - Tribunais Superiores" : uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Instância *</Label>
                  <Select value={formData.instance} onValueChange={(v) => setFormData(prev => ({ ...prev, instance: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1ª Instância</SelectItem>
                      <SelectItem value="2">2ª Instância</SelectItem>
                      <SelectItem value="3">Instâncias Superiores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="codTribunal">Código do Tribunal</Label>
                  <Input
                    id="codTribunal"
                    type="number"
                    placeholder="Ex: 8"
                    value={formData.codTribunal}
                    onChange={(e) => setFormData(prev => ({ ...prev, codTribunal: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="comarca">Comarca</Label>
                  <Input
                    id="comarca"
                    placeholder="Ex: São Paulo"
                    value={formData.comarca}
                    onChange={(e) => setFormData(prev => ({ ...prev, comarca: e.target.value }))}
                  />
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Código do Tribunal e Comarca são opcionais. Preencha para maior precisão na localização do processo.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 3: Partes do Processo */}
          {step === 3 && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="autor">Autor</Label>
                <Input
                  id="autor"
                  placeholder="Nome do autor do processo"
                  value={formData.autor}
                  onChange={(e) => setFormData(prev => ({ ...prev, autor: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reu">Réu</Label>
                <Input
                  id="reu"
                  placeholder="Nome do réu do processo"
                  value={formData.reu}
                  onChange={(e) => setFormData(prev => ({ ...prev, reu: e.target.value }))}
                />
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Informar autor e réu é opcional, mas pode acelerar a validação do processo junto ao tribunal.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handleBack} disabled={loading}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={handleNext}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={loading}>
                {loading ? "Cadastrando..." : "Cadastrar Processo"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
