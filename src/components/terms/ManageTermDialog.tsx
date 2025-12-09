import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";

interface ManageTermDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  termType: 'name' | 'office';
  termData?: {
    id?: string;
    term: string;
    cod_nome?: number;
    cod_escritorio?: number;
    variacoes?: string[];
  };
  serviceId: string;
  onSuccess: () => void;
}

export function ManageTermDialog({
  open,
  onOpenChange,
  mode,
  termType,
  termData,
  serviceId,
  onSuccess,
}: ManageTermDialogProps) {
  const [term, setTerm] = useState("");
  const [variacoes, setVariacoes] = useState<string[]>([]);
  const [novaVariacao, setNovaVariacao] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (termData) {
      setTerm(termData.term);
      setVariacoes(termData.variacoes || []);
    } else {
      setTerm("");
      setVariacoes([]);
    }
  }, [termData, open]);

  const handleAddVariacao = () => {
    if (novaVariacao.trim() && !variacoes.includes(novaVariacao.trim())) {
      setVariacoes([...variacoes, novaVariacao.trim()]);
      setNovaVariacao("");
    }
  };

  const handleRemoveVariacao = (index: number) => {
    setVariacoes(variacoes.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!term.trim()) {
      toast.error(termType === 'name' ? 'Nome é obrigatório' : 'Escritório é obrigatório');
      return;
    }

    setIsLoading(true);

    try {
      const action = termType === 'name'
        ? mode === 'create' ? 'cadastrar_nome' : 'editar_nome'
        : mode === 'create' ? 'cadastrar_escritorio' : 'ativar_escritorio';

      const data: any = termType === 'name'
        ? { nome: term, variacoes, cod_nome: termData?.cod_nome }
        : { escritorio: term, cod_escritorio: termData?.cod_escritorio };

      const { data: result, error } = await supabase.functions.invoke('manage-search-terms', {
        body: {
          service_id: serviceId,
          action,
          data,
        },
      });

      if (error) throw error;

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(
        mode === 'create'
          ? `${termType === 'name' ? 'Nome' : 'Escritório'} cadastrado com sucesso`
          : `${termType === 'name' ? 'Nome' : 'Escritório'} atualizado com sucesso`
      );

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error managing term:', error);
      toast.error(error.message || 'Erro ao processar solicitação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Cadastrar' : 'Editar'}{' '}
            {termType === 'name' ? 'Nome de Pesquisa' : 'Escritório'}
          </DialogTitle>
          <DialogDescription>
            {termType === 'name'
              ? 'Cadastre um novo nome para monitoramento de publicações'
              : 'Cadastre um novo escritório no sistema'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="term">
              {termType === 'name' ? 'Nome' : 'Nome do Escritório'}
            </Label>
            <Input
              id="term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={termType === 'name' ? 'Ex: João da Silva' : 'Ex: Escritório ABC'}
            />
          </div>

          {termType === 'name' && (
            <div className="space-y-2">
              <Label>Variações do Nome</Label>
              <p className="text-xs text-muted-foreground">
                Adicione variações ortográficas ou abreviações que devem ser buscadas
              </p>
              
              <div className="flex gap-2">
                <Input
                  value={novaVariacao}
                  onChange={(e) => setNovaVariacao(e.target.value)}
                  placeholder="Ex: J. Silva"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVariacao();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddVariacao}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {variacoes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {variacoes.map((v, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1">
                      {v}
                      <button
                        type="button"
                        onClick={() => handleRemoveVariacao(idx)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Cadastrar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
