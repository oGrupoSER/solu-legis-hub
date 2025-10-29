import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface SearchTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: any;
}

export const SearchTermDialog = ({ open, onOpenChange, term }: SearchTermDialogProps) => {
  const [formData, setFormData] = useState({
    term: "",
    term_type: "processes",
    partner_id: "",
    partner_service_id: "",
    is_active: true,
  });
  const [partners, setPartners] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPartners();
      if (term) {
        setFormData({
          term: term.term || "",
          term_type: term.term_type || "processes",
          partner_id: term.partner_id || "",
          partner_service_id: term.partner_service_id || "",
          is_active: term.is_active ?? true,
        });
        if (term.partner_id) {
          fetchServices(term.partner_id);
        }
      }
    }
  }, [open, term]);

  const fetchPartners = async () => {
    const { data } = await supabase.from("partners").select("id, name").eq("is_active", true);
    setPartners(data || []);
  };

  const fetchServices = async (partnerId: string) => {
    if (!partnerId) {
      setServices([]);
      return;
    }
    const { data } = await supabase
      .from("partner_services")
      .select("id, service_name")
      .eq("partner_id", partnerId)
      .eq("is_active", true);
    setServices(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const dataToSave = {
        ...formData,
        partner_id: formData.partner_id || null,
        partner_service_id: formData.partner_service_id || null,
      };

      if (term) {
        const { error } = await supabase
          .from("search_terms")
          .update(dataToSave)
          .eq("id", term.id);
        if (error) throw error;
        toast.success("Termo atualizado com sucesso");
      } else {
        const { error } = await supabase.from("search_terms").insert(dataToSave);
        if (error) throw error;
        toast.success("Termo criado com sucesso");
      }

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
            <Select
              value={formData.term_type}
              onValueChange={(value) => setFormData({ ...formData, term_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="processes">Processos</SelectItem>
                <SelectItem value="distributions">Distribuições</SelectItem>
                <SelectItem value="publications">Publicações</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner">Parceiro (opcional)</Label>
            <Select
              value={formData.partner_id}
              onValueChange={(value) => {
                setFormData({ ...formData, partner_id: value, partner_service_id: "" });
                fetchServices(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um parceiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
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
                  setFormData({ ...formData, partner_service_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.service_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Termo Ativo</Label>
            <Switch
              id="active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : term ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
