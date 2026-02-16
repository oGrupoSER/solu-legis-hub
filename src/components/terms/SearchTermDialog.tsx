import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ClientSelector } from "@/components/shared/ClientSelector";

interface SearchTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: any;
}

export const SearchTermDialog = ({ open, onOpenChange, term }: SearchTermDialogProps) => {
  const [formData, setFormData] = useState({
    term: "",
    term_type: "office",
    partner_id: "",
    partner_service_id: "",
    is_active: true,
  });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [clientError, setClientError] = useState(false);
  const [partners, setPartners] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPartners();
      if (term) {
        setFormData({
          term: term.term || "",
          term_type: term.term_type || "office",
          partner_id: term.partner_id || "",
          partner_service_id: term.partner_service_id || "",
          is_active: term.is_active ?? true,
        });
        if (term.partner_id) {
          fetchServices(term.partner_id);
        }
        // Load existing client links
        fetchTermClients(term.id);
      } else {
        setSelectedClients([]);
        setClientError(false);
      }
    }
  }, [open, term]);

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").eq("is_active", true);
    setPartners(data || []);
  };

  const fetchServices = async (partnerId: string) => {
    if (!partnerId) { setServices([]); return; }
    const { data } = await supabase
      .from("partner_services")
      .select("id, service_name")
      .eq("partner_id", partnerId)
      .eq("service_type", "terms")
      .eq("is_active", true);
    setServices(data || []);
  };

  const fetchTermClients = async (termId: string) => {
    const { data } = await supabase
      .from("client_search_terms")
      .select("client_system_id")
      .eq("search_term_id", termId);
    setSelectedClients((data || []).map((d) => d.client_system_id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedClients.length === 0) {
      setClientError(true);
      toast.error("Selecione ao menos um cliente");
      return;
    }
    setClientError(false);
    setIsLoading(true);

    try {
      const dataToSave = {
        ...formData,
        partner_id: formData.partner_id || null,
        partner_service_id: formData.partner_service_id || null,
      };

      let termId: string;

      if (term) {
        const { error } = await supabase.from("search_terms").update(dataToSave).eq("id", term.id);
        if (error) throw error;
        termId = term.id;
      } else {
        const { data: inserted, error } = await supabase.from("search_terms").insert(dataToSave).select("id").single();
        if (error) throw error;
        termId = inserted.id;
      }

      // Sync client links
      await supabase.from("client_search_terms").delete().eq("search_term_id", termId);
      if (selectedClients.length > 0) {
        const links = selectedClients.map((clientId) => ({
          search_term_id: termId,
          client_system_id: clientId,
        }));
        const { error: linkError } = await supabase.from("client_search_terms").insert(links);
        if (linkError) throw linkError;
      }

      toast.success(term ? "Termo atualizado com sucesso" : "Termo criado com sucesso");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar termo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{term ? "Editar Termo" : "Novo Termo de Busca"}</DialogTitle>
          <DialogDescription>
            Configure o termo que será utilizado nas buscas e sincronizações
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="term">Termo</Label>
            <Input
              id="term"
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              placeholder="Digite o termo de busca"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={formData.term_type} onValueChange={(value) => setFormData({ ...formData, term_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Escritório</SelectItem>
                <SelectItem value="name">Nome de Pesquisa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner">Parceiro (opcional)</Label>
            <Select
              value={formData.partner_id}
              onValueChange={(value) => {
                const partnerId = value === "none" ? "" : value;
                setFormData({ ...formData, partner_id: partnerId, partner_service_id: "" });
                fetchServices(partnerId);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um parceiro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.partner_id && (
            <div className="space-y-2">
              <Label htmlFor="service">Serviço (opcional)</Label>
              <Select
                value={formData.partner_service_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, partner_service_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ClientSelector
            serviceId={formData.partner_service_id || undefined}
            selectedIds={selectedClients}
            onChange={(ids) => { setSelectedClients(ids); setClientError(false); }}
            error={clientError}
          />

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Termo Ativo</Label>
            <Switch
              id="active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : term ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
