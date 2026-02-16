import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Key, ShieldOff, ShieldCheck, Settings } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TokenSecurityManager = () => {
  const queryClient = useQueryClient();
  const [editToken, setEditToken] = useState<any>(null);
  const [blockReason, setBlockReason] = useState("");
  const [rateLimitOverride, setRateLimitOverride] = useState("");
  const [allowedIps, setAllowedIps] = useState("");

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["all-tokens-security"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_tokens")
        .select("*, client_systems(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, is_blocked, reason }: { id: string; is_blocked: boolean; reason?: string }) => {
      const update: any = {
        is_blocked,
        blocked_reason: is_blocked ? reason : null,
        blocked_at: is_blocked ? new Date().toISOString() : null,
      };
      const { error } = await supabase.from("api_tokens").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tokens-security"] });
      toast.success("Token atualizado");
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async ({ id, rate_limit_override, allowed_ips }: { id: string; rate_limit_override: number | null; allowed_ips: string[] | null }) => {
      const { error } = await supabase.from("api_tokens").update({ rate_limit_override, allowed_ips }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tokens-security"] });
      setEditToken(null);
      toast.success("Configurações do token atualizadas");
    },
  });

  const openSettings = (token: any) => {
    setEditToken(token);
    setRateLimitOverride(token.rate_limit_override?.toString() || "");
    setAllowedIps(token.allowed_ips?.join(", ") || "");
  };

  const getStatus = (token: any) => {
    if (token.is_blocked) return { label: "Bloqueado", variant: "destructive" as const };
    if (!token.is_active) return { label: "Inativo", variant: "secondary" as const };
    if (token.expires_at && new Date(token.expires_at) < new Date()) return { label: "Expirado", variant: "outline" as const };
    return { label: "Ativo", variant: "default" as const };
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Segurança de Tokens
          </CardTitle>
          <CardDescription>Gerencie bloqueios, rate limits e whitelists de IP por token</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !tokens?.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum token encontrado</p>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rate Limit</TableHead>
                    <TableHead>IPs Permitidos</TableHead>
                    <TableHead>Último Uso</TableHead>
                    <TableHead className="w-[140px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token: any) => {
                    const status = getStatus(token);
                    return (
                      <TableRow key={token.id}>
                        <TableCell className="font-medium">{token.name}</TableCell>
                        <TableCell className="text-sm">{token.client_systems?.name || "-"}</TableCell>
                        <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                        <TableCell className="text-sm">{token.rate_limit_override ? `${token.rate_limit_override}/h` : "Padrão"}</TableCell>
                        <TableCell className="text-sm">{token.allowed_ips?.length ? `${token.allowed_ips.length} IP(s)` : "Todos"}</TableCell>
                        <TableCell className="text-sm">{token.last_used_at ? format(new Date(token.last_used_at), "dd/MM HH:mm") : "Nunca"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" title="Configurações" onClick={() => openSettings(token)}>
                              <Settings className="h-4 w-4" />
                            </Button>
                            {token.is_blocked ? (
                              <Button variant="ghost" size="icon" title="Desbloquear" onClick={() => blockMutation.mutate({ id: token.id, is_blocked: false })}>
                                <ShieldCheck className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" title="Bloquear" onClick={() => {
                                const reason = prompt("Motivo do bloqueio:");
                                if (reason) blockMutation.mutate({ id: token.id, is_blocked: true, reason });
                              }}>
                                <ShieldOff className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editToken} onOpenChange={(o) => !o && setEditToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurações do Token: {editToken?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editToken?.is_blocked && (
              <div className="bg-destructive/10 p-3 rounded-md text-sm">
                <strong>Token bloqueado:</strong> {editToken.blocked_reason}
                <br /><span className="text-xs">Desde: {editToken.blocked_at ? format(new Date(editToken.blocked_at), "dd/MM/yyyy HH:mm") : "-"}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Rate Limit Personalizado (req/hora)</Label>
              <Input type="number" value={rateLimitOverride} onChange={(e) => setRateLimitOverride(e.target.value)} placeholder="Padrão: 1000" />
              <p className="text-xs text-muted-foreground">Deixe vazio para usar o padrão do sistema</p>
            </div>
            <div className="space-y-2">
              <Label>IPs Permitidos (whitelist)</Label>
              <Textarea value={allowedIps} onChange={(e) => setAllowedIps(e.target.value)} placeholder="192.168.1.1, 10.0.0.1" rows={3} />
              <p className="text-xs text-muted-foreground">Separe múltiplos IPs com vírgula. Vazio = todos permitidos</p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const rateLimit = rateLimitOverride ? parseInt(rateLimitOverride) : null;
                const ips = allowedIps ? allowedIps.split(",").map(ip => ip.trim()).filter(Boolean) : null;
                updateSettingsMutation.mutate({ id: editToken.id, rate_limit_override: rateLimit, allowed_ips: ips && ips.length > 0 ? ips : null });
              }}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TokenSecurityManager;
