import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ClientSelector } from "@/components/shared/ClientSelector";
import { Info, ChevronLeft, ChevronRight } from "lucide-react";

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

const STEPS = [
  { label: "Dados Básicos", number: 1 },
  { label: "Localização", number: 2 },
  { label: "Partes", number: 3 },
];

interface EditProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  process: {
    id: string;
    process_number: string;
    uf: string | null;
    instance: string | null;
    partner_service_id: string | null;
    raw_data?: any;
  } | null;
}

export function EditProcessDialog({ open, onOpenChange, onSuccess, process }: EditProcessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    processNumber: "",
    uf: "",
    instance: "1",
    codTribunal: "",
    comarca: "",
    autor: "",
    reu: "",
  });

  useEffect(() => {
    if (open && process) {
      const raw = process.raw_data || {};
      setFormData({
        processNumber: process.process_number,
        uf: process.uf || "",
        instance: process.instance || "1",
        codTribunal: raw.codTribunal ? String(raw.codTribunal) : "",
        comarca: raw.Comarca || raw.comarca || "",
        autor: raw.Autor || raw.autor || "",
        reu: raw.Reu || raw.reu || "",
      });
      setStep(1);
      fetchLinkedClients();
    }
  }, [open, process]);

  const fetchLinkedClients = async () => {
    if (!process) return;
    const { data } = await supabase
      .from("client_processes")
      .select("client_system_id")
      .eq("process_id", process.id);
    setSelectedClients((data || []).map((d) => d.client_system_id));
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
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!process) return;
    if (!validateStep1()) { setStep(1); return; }

    try {
      setLoading(true);

      const numberChanged = formData.processNumber.trim() !== process.process_number;

      const existingRaw = process.raw_data || {};
      const mergedRawData = {
        ...existingRaw,
        codTribunal: formData.codTribunal ? parseInt(formData.codTribunal) : undefined,
        Comarca: formData.comarca || undefined,
        Autor: formData.autor || undefined,
        Reu: formData.reu || undefined,
      };

      const updateData: any = {
        process_number: formData.processNumber.trim(),
        uf: formData.uf || null,
        instance: formData.instance || null,
        raw_data: mergedRawData,
        updated_at: new Date().toISOString(),
      };

      if (numberChanged) {
        updateData.status_code = 2;
        updateData.status_description = "Validando";
        updateData.solucionare_status = "pending";
      }

      const { error } = await supabase
        .from("processes")
        .update(updateData)
        .eq("id", process.id);

      if (error) throw error;

      // Sync client links
      await supabase.from("client_processes").delete().eq("process_id", process.id);
      if (selectedClients.length > 0) {
        const inserts = selectedClients.map((clientId) => ({
          process_id: process.id,
          client_system_id: clientId,
        }));
        await supabase.from("client_processes").insert(inserts);
      }

      toast.success(numberChanged
        ? "Processo atualizado. Será re-cadastrado na próxima sincronização."
        : "Processo atualizado com sucesso"
      );
      onSuccess();
    } catch (error) {
      console.error("Error updating process:", error);
      toast.error("Erro ao atualizar processo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Processo</DialogTitle>
          <DialogDescription>
            Altere os dados do processo CNJ.
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
                <Label htmlFor="editProcessNumber">Número do Processo (CNJ) *</Label>
                <Input
                  id="editProcessNumber"
                  placeholder="0000000-00.0000.0.00.0000"
                  value={formData.processNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, processNumber: formatCNJ(e.target.value) }))}
                />
              </div>

              <ClientSelector
                serviceId={process?.partner_service_id || undefined}
                selectedIds={selectedClients}
                onChange={setSelectedClients}
              />
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
                  <Label>Instância</Label>
                  <Select value={formData.instance} onValueChange={(v) => setFormData(prev => ({ ...prev, instance: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Todas</SelectItem>
                      <SelectItem value="1">1ª Instância</SelectItem>
                      <SelectItem value="2">2ª Instância</SelectItem>
                      <SelectItem value="3">Instâncias Superiores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="editCodTribunal">Código do Tribunal</Label>
                  <Input
                    id="editCodTribunal"
                    type="number"
                    placeholder="Ex: 8"
                    value={formData.codTribunal}
                    onChange={(e) => setFormData(prev => ({ ...prev, codTribunal: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editComarca">Comarca</Label>
                  <Input
                    id="editComarca"
                    placeholder="Ex: São Paulo"
                    value={formData.comarca}
                    onChange={(e) => setFormData(prev => ({ ...prev, comarca: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Partes do Processo */}
          {step === 3 && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="editAutor">Autor</Label>
                <Input
                  id="editAutor"
                  placeholder="Nome do autor do processo"
                  value={formData.autor}
                  onChange={(e) => setFormData(prev => ({ ...prev, autor: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="editReu">Réu</Label>
                <Input
                  id="editReu"
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
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
