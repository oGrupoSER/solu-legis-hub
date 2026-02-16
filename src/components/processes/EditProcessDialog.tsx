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
  "RS","RO","RR","SC","SP","SE","TO"
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
  } | null;
}

export function EditProcessDialog({ open, onOpenChange, onSuccess, process }: EditProcessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    processNumber: "",
    uf: "",
    instance: "1",
  });

  useEffect(() => {
    if (open && process) {
      setFormData({
        processNumber: process.process_number,
        uf: process.uf || "",
        instance: process.instance || "1",
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!process) return;

    if (!formData.processNumber.trim()) {
      toast.error("Número do processo é obrigatório");
      return;
    }

    if (!CNJ_REGEX.test(formData.processNumber.trim())) {
      toast.error("Formato CNJ inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO");
      return;
    }

    try {
      setLoading(true);

      const numberChanged = formData.processNumber.trim() !== process.process_number;

      // Update the process record
      const updateData: any = {
        process_number: formData.processNumber.trim(),
        uf: formData.uf || null,
        instance: formData.instance || null,
        updated_at: new Date().toISOString(),
      };

      // If number changed, reset status to re-validate
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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Processo</DialogTitle>
            <DialogDescription>
              Altere o número CNJ, UF, instância ou clientes vinculados.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editProcessNumber">Número do Processo (CNJ) *</Label>
              <Input
                id="editProcessNumber"
                placeholder="0000000-00.0000.0.00.0000"
                value={formData.processNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, processNumber: formatCNJ(e.target.value) }))}
                required
              />
            </div>

            <ClientSelector
              serviceId={process?.partner_service_id || undefined}
              selectedIds={selectedClients}
              onChange={setSelectedClients}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>UF</Label>
                <Select value={formData.uf} onValueChange={(v) => setFormData(prev => ({ ...prev, uf: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
