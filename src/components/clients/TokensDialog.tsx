import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Copy, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Token {
  id: string;
  name: string;
  token: string;
  expires_at: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface TokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemId: string | null;
}

export const TokensDialog = ({ open, onOpenChange, systemId }: TokensDialogProps) => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewToken, setShowNewToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");

  const fetchTokens = async () => {
    if (!systemId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("api_tokens")
        .select("*")
        .eq("client_system_id", systemId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar tokens");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && systemId) {
      fetchTokens();
    }
  }, [open, systemId]);

  const generateToken = () => {
    return `ljhub_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  };

  const handleCreateToken = async () => {
    if (!systemId || !newTokenName.trim()) {
      toast.error("Nome do token é obrigatório");
      return;
    }

    setIsLoading(true);
    try {
      const token = generateToken();
      const { error } = await supabase.from("api_tokens").insert([
        {
          client_system_id: systemId,
          name: newTokenName,
          token,
          is_active: true,
        },
      ]);

      if (error) throw error;
      toast.success("Token criado com sucesso");
      setNewTokenName("");
      setShowNewToken(false);
      fetchTokens();
    } catch (error: any) {
      toast.error("Erro ao criar token");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado para a área de transferência");
  };

  const handleDeleteToken = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este token?")) return;

    try {
      const { error } = await supabase.from("api_tokens").delete().eq("id", id);
      if (error) throw error;
      toast.success("Token excluído com sucesso");
      fetchTokens();
    } catch (error: any) {
      toast.error("Erro ao excluir token");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Tokens de API</DialogTitle>
          <DialogDescription>
            Crie e gerencie tokens de autenticação para este sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!showNewToken ? (
            <Button onClick={() => setShowNewToken(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Novo Token
            </Button>
          ) : (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <Label htmlFor="token-name">Nome do Token</Label>
              <Input
                id="token-name"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="Ex: Produção, Desenvolvimento, etc"
              />
              <div className="flex gap-2">
                <Button onClick={handleCreateToken} disabled={isLoading} size="sm">
                  Criar
                </Button>
                <Button onClick={() => setShowNewToken(false)} variant="outline" size="sm">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {isLoading && tokens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum token cadastrado
              </div>
            ) : (
              tokens.map((token) => (
                <div key={token.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground">{token.name}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={token.is_active ? "default" : "secondary"}>
                        {token.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteToken(token.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                      {token.token}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyToken(token.token)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Criado em: {format(new Date(token.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    {token.last_used_at && (
                      <p>Último uso: {format(new Date(token.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
