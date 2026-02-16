import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const IpRulesManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [form, setForm] = useState({
    ip_address: "",
    rule_type: "block",
    reason: "",
    client_system_id: "",
    expires_at: "",
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ["ip-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_ip_rules")
        .select("*, client_systems(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["client-systems-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_systems").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (rule: any) => {
      const payload = {
        ip_address: rule.ip_address,
        rule_type: rule.rule_type,
        reason: rule.reason || null,
        client_system_id: rule.client_system_id || null,
        expires_at: rule.expires_at || null,
        is_active: true,
        created_by: "admin",
      };
      if (rule.id) {
        const { error } = await supabase.from("api_ip_rules").update(payload).eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("api_ip_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip-rules"] });
      setDialogOpen(false);
      resetForm();
      toast.success("Regra de IP salva com sucesso");
    },
    onError: () => toast.error("Erro ao salvar regra"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_ip_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ip-rules"] });
      toast.success("Regra removida");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("api_ip_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ip-rules"] }),
  });

  const resetForm = () => {
    setForm({ ip_address: "", rule_type: "block", reason: "", client_system_id: "", expires_at: "" });
    setEditingRule(null);
  };

  const openEdit = (rule: any) => {
    setForm({
      ip_address: rule.ip_address,
      rule_type: rule.rule_type,
      reason: rule.reason || "",
      client_system_id: rule.client_system_id || "",
      expires_at: rule.expires_at ? rule.expires_at.substring(0, 16) : "",
    });
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const isExpired = (expiresAt: string | null) => expiresAt && new Date(expiresAt) < new Date();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Regras de IP
            </CardTitle>
            <CardDescription>Bloqueie ou permita IPs específicos (global ou por cliente)</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" />Nova Regra</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de IP"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Endereço IP / CIDR</Label>
                  <Input value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.0/24 ou 10.0.0.1" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.rule_type} onValueChange={(v) => setForm({ ...form, rule_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Bloquear</SelectItem>
                      <SelectItem value="allow">Permitir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Escopo (Cliente)</Label>
                  <Select value={form.client_system_id || "global"} onValueChange={(v) => setForm({ ...form, client_system_id: v === "global" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (todos os clientes)</SelectItem>
                      {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Motivo do bloqueio..." />
                </div>
                <div className="space-y-2">
                  <Label>Expira em (opcional)</Label>
                  <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
                </div>
                <Button className="w-full" onClick={() => saveMutation.mutate({ ...form, id: editingRule?.id })} disabled={!form.ip_address || saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : !rules?.length ? (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhuma regra de IP configurada</p>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule: any) => (
                  <TableRow key={rule.id} className={isExpired(rule.expires_at) ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-sm">{rule.ip_address}</TableCell>
                    <TableCell>
                      <Badge variant={rule.rule_type === "block" ? "destructive" : "default"}>{rule.rule_type === "block" ? "Bloqueio" : "Permissão"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{rule.client_systems?.name || "Global"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{rule.reason || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {rule.expires_at ? (
                        <span className={isExpired(rule.expires_at) ? "text-destructive" : ""}>{format(new Date(rule.expires_at), "dd/MM/yyyy HH:mm")}{isExpired(rule.expires_at) && " (expirado)"}</span>
                      ) : "Permanente"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={rule.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, is_active: v })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(rule.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
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

export default IpRulesManager;
