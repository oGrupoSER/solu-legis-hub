import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClientSystem {
  id: string;
  name: string;
  description: string | null;
  contact_email: string | null;
  is_active: boolean;
}

interface ClientSystemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  system?: ClientSystem | null;
}

export const ClientSystemDialog = ({ open, onOpenChange, system }: ClientSystemDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    contact_email: "",
    is_active: true,
  });

  useEffect(() => {
    if (system) {
      setFormData({
        name: system.name,
        description: system.description || "",
        contact_email: system.contact_email || "",
        is_active: system.is_active,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        contact_email: "",
        is_active: true,
      });
    }
  }, [system, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (system) {
        const { error } = await supabase
          .from("client_systems")
          .update(formData)
          .eq("id", system.id);
        if (error) throw error;
        toast.success("Sistema atualizado com sucesso");
      } else {
        const { error } = await supabase.from("client_systems").insert([formData]);
        if (error) throw error;
        toast.success("Sistema cadastrado com sucesso");
      }
      onOpenChange(true);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar sistema");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onOpenChange(false)}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{system ? "Editar" : "Novo"} Sistema Cliente</DialogTitle>
            <DialogDescription>
              {system ? "Edite" : "Cadastre"} as informações do sistema que consumirá a API
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact_email">Email de Contato</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="contato@sistema.com"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Sistema ativo</Label>
            </div>
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
