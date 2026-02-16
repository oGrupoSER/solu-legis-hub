import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldX, Ban } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const SecurityLogsTable = () => {
  const queryClient = useQueryClient();
  const [filterReason, setFilterReason] = useState("all");
  const [filterIp, setFilterIp] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["security-logs", filterReason, filterIp],
    queryFn: async () => {
      let query = supabase
        .from("api_security_logs")
        .select("*, client_systems(name), api_tokens(name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterReason !== "all") query = query.eq("block_reason", filterReason);
      if (filterIp) query = query.ilike("ip_address", `%${filterIp}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const blockIpMutation = useMutation({
    mutationFn: async (ip: string) => {
      const { error } = await supabase.from("api_ip_rules").insert({
        ip_address: ip,
        rule_type: "block",
        reason: "Bloqueado a partir do log de segurança",
        is_active: true,
        created_by: "admin",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip-rules"] });
      toast.success("IP bloqueado com sucesso");
    },
  });

  const reasonLabels: Record<string, string> = {
    ip_blocked: "IP Bloqueado",
    token_blocked: "Token Bloqueado",
    token_inactive: "Token Inativo",
    token_expired: "Token Expirado",
    ip_not_whitelisted: "IP não Permitido",
    rate_limit: "Rate Limit",
    service_denied: "Serviço Negado",
  };

  const reasonColors: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
    ip_blocked: "destructive",
    token_blocked: "destructive",
    rate_limit: "secondary",
    service_denied: "outline",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Log de Bloqueios
        </CardTitle>
        <CardDescription>Tentativas de acesso que foram bloqueadas pelo sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input placeholder="Filtrar por IP..." value={filterIp} onChange={(e) => setFilterIp(e.target.value)} />
          </div>
          <Select value={filterReason} onValueChange={setFilterReason}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motivos</SelectItem>
              <SelectItem value="ip_blocked">IP Bloqueado</SelectItem>
              <SelectItem value="token_blocked">Token Bloqueado</SelectItem>
              <SelectItem value="token_inactive">Token Inativo</SelectItem>
              <SelectItem value="token_expired">Token Expirado</SelectItem>
              <SelectItem value="ip_not_whitelisted">IP não Permitido</SelectItem>
              <SelectItem value="rate_limit">Rate Limit</SelectItem>
              <SelectItem value="service_denied">Serviço Negado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : !logs?.length ? (
          <div className="text-center py-8">
            <ShieldX className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground text-sm">Nenhum bloqueio registrado</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="w-[60px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">{format(new Date(log.created_at), "dd/MM/yy HH:mm:ss")}</TableCell>
                    <TableCell className="font-mono text-sm">{log.ip_address || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={reasonColors[log.block_reason] || "secondary"}>
                        {reasonLabels[log.block_reason] || log.block_reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.api_tokens?.name || "-"}</TableCell>
                    <TableCell className="text-sm">{log.client_systems?.name || "-"}</TableCell>
                    <TableCell className="text-sm font-mono">{log.endpoint || "-"}</TableCell>
                    <TableCell>
                      {log.ip_address && log.ip_address !== "unknown" && (
                        <Button variant="ghost" size="icon" title="Bloquear IP" onClick={() => blockIpMutation.mutate(log.ip_address)}>
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SecurityLogsTable;
