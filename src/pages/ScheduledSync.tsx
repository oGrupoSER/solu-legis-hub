import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Clock, Play, Plus, Pencil, Trash2, RefreshCw, CalendarClock,
  CheckCircle2, XCircle, Loader2, Newspaper, FolderInput, Gavel,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SyncJob {
  id: string;
  name: string;
  services: string[];
  cron_expression: string;
  is_active: boolean;
  pg_cron_job_id: number | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SyncLog {
  id: string;
  job_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  result: any;
  error_message: string | null;
  scheduled_sync_jobs?: { name: string; services: string[] };
}

const SERVICE_OPTIONS = [
  { value: "publications", label: "Publicações", icon: Newspaper },
  { value: "distributions", label: "Distribuições", icon: FolderInput },
  { value: "processes", label: "Processos", icon: Gavel },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function cronToHours(expr: string): number[] {
  // Parse "0 9,10,11 * * *" → [9,10,11]
  const parts = expr.split(" ");
  if (parts.length < 5) return [];
  const hourPart = parts[1];
  if (hourPart === "*") return HOURS;
  return hourPart.split(",").map(Number).filter((n) => !isNaN(n));
}

function hoursToCron(hours: number[]): string {
  if (hours.length === 0) return "0 * * * *";
  const sorted = [...hours].sort((a, b) => a - b);
  return `0 ${sorted.join(",")} * * *`;
}

function utcHoursToBrt(utcHours: number[]): number[] {
  return utcHours.map((h) => ((h - 3 + 24) % 24));
}

function brtHoursToUtc(brtHours: number[]): number[] {
  return brtHours.map((h) => ((h + 3) % 24));
}

const ScheduledSync = () => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<SyncJob | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formServices, setFormServices] = useState<string[]>([]);
  const [formHours, setFormHours] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadJobs(), loadLogs()]);
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from("scheduled_sync_jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setJobs((data as unknown as SyncJob[]) || []);
  };

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from("scheduled_sync_logs")
      .select("*, scheduled_sync_jobs(name, services)")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    setLogs((data as unknown as SyncLog[]) || []);
  };

  const openCreateDialog = () => {
    setEditingJob(null);
    setFormName("");
    setFormServices(["publications", "distributions", "processes"]);
    setFormHours([6, 7, 8, 9, 12, 16, 17, 22]);
    setDialogOpen(true);
  };

  const openEditDialog = (job: SyncJob) => {
    setEditingJob(job);
    setFormName(job.name);
    setFormServices([...job.services]);
    setFormHours(utcHoursToBrt(cronToHours(job.cron_expression)));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || formServices.length === 0 || formHours.length === 0) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const cronExpression = hoursToCron(brtHoursToUtc(formHours));
      const action = editingJob ? "update" : "create";
      const payload: any = {
        action,
        name: formName.trim(),
        services: formServices,
        cron_expression: cronExpression,
      };
      if (editingJob) payload.id = editingJob.id;

      const { data, error } = await supabase.functions.invoke("manage-scheduled-sync", {
        body: payload,
      });

      if (error) throw error;
      toast.success(editingJob ? "Agendamento atualizado" : "Agendamento criado");
      setDialogOpen(false);
      await loadJobs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar agendamento");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (job: SyncJob) => {
    try {
      await supabase.functions.invoke("manage-scheduled-sync", {
        body: { action: "toggle", id: job.id },
      });
      toast.success(job.is_active ? "Agendamento desativado" : "Agendamento ativado");
      await loadJobs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status");
    }
  };

  const handleDelete = async (job: SyncJob) => {
    if (!confirm(`Deseja excluir o agendamento "${job.name}"?`)) return;
    try {
      await supabase.functions.invoke("manage-scheduled-sync", {
        body: { action: "delete", id: job.id },
      });
      toast.success("Agendamento excluído");
      await loadJobs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir");
    }
  };

  const handleRunNow = async (job: SyncJob) => {
    setRunningJobId(job.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-scheduled-sync", {
        body: { action: "run-now", id: job.id },
      });
      if (error) throw error;
      toast.success("Sincronização executada com sucesso");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao executar sincronização");
    } finally {
      setRunningJobId(null);
    }
  };

  const activeJobs = jobs.filter((j) => j.is_active).length;
  const lastRun = jobs
    .filter((j) => j.last_run_at)
    .sort((a, b) => new Date(b.last_run_at!).getTime() - new Date(a.last_run_at!).getTime())[0];

  const serviceLabel = (s: string) =>
    SERVICE_OPTIONS.find((o) => o.value === s)?.label || s;

  const toggleService = (value: string) => {
    setFormServices((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const toggleHour = (hour: number) => {
    setFormHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]
    );
  };

  return (
    <div className="space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Agendamentos" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agendamentos de Sincronização</h1>
          <p className="text-muted-foreground">
            Configure horários automáticos para sincronizar publicações, distribuições e processos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeJobs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Última Execução</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {lastRun?.last_run_at
                ? formatDistanceToNow(new Date(lastRun.last_run_at), { addSuffix: true, locale: ptBR })
                : "Nenhuma"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Execuções (últimas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <span className="text-green-600 font-bold">
                {logs.filter((l) => l.status === "success").length} ✓
              </span>
              <span className="text-destructive font-bold">
                {logs.filter((l) => l.status === "error").length} ✗
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">
            <CalendarClock className="h-4 w-4 mr-2" />
            Agendamentos
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="h-4 w-4 mr-2" />
            Histórico de Execuções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead>Horários (BRT)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Execução</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum agendamento configurado
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => {
                      const brtHours = utcHoursToBrt(cronToHours(job.cron_expression));
                      return (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {job.services.map((s) => (
                                <Badge key={s} variant="secondary" className="text-xs">
                                  {serviceLabel(s)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {brtHours.sort((a, b) => a - b).map((h) => (
                                <Badge key={h} variant="outline" className="text-xs font-mono">
                                  {String(h).padStart(2, "0")}h
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={job.is_active}
                                onCheckedChange={() => handleToggle(job)}
                              />
                              <span className={cn("text-sm", job.is_active ? "text-green-600" : "text-muted-foreground")}>
                                {job.is_active ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {job.last_run_at
                              ? format(new Date(job.last_run_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "Nunca"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRunNow(job)}
                                disabled={runningJobId === job.id}
                              >
                                {runningJobId === job.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openEditDialog(job)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDelete(job)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhuma execução registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const duration = log.completed_at && log.started_at
                        ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                        : null;

                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">
                            {log.scheduled_sync_jobs?.name || "—"}
                          </TableCell>
                          <TableCell>
                            {log.status === "success" && (
                              <Badge variant="default" className="bg-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
                              </Badge>
                            )}
                            {log.status === "error" && (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" /> Erro
                              </Badge>
                            )}
                            {log.status === "running" && (
                              <Badge variant="secondary">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Executando
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(log.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {duration !== null ? `${duration}s` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {log.error_message || (log.result?.summary
                              ? `Pub: ${log.result.summary.publications_synced || 0} | Dist: ${log.result.summary.distributions_synced || 0} | Proc: ${log.result.summary.processes_synced || 0}`
                              : "—")}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingJob ? "Editar Agendamento" : "Novo Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Nome do Agendamento</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Sincronização Diária"
              />
            </div>

            <div className="space-y-2">
              <Label>Serviços</Label>
              <div className="flex flex-wrap gap-3">
                {SERVICE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formServices.includes(opt.value)}
                      onCheckedChange={() => toggleService(opt.value)}
                    />
                    <opt.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Horários (Brasília)</Label>
              <p className="text-xs text-muted-foreground">Clique nos horários desejados</p>
              <div className="grid grid-cols-8 gap-1.5">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => toggleHour(h)}
                    className={cn(
                      "text-xs font-mono py-1.5 px-1 rounded-md border transition-colors",
                      formHours.includes(h)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {String(h).padStart(2, "0")}h
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Selecionados: {formHours.length > 0
                  ? formHours.sort((a, b) => a - b).map((h) => `${String(h).padStart(2, "0")}h`).join(", ")
                  : "Nenhum"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingJob ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduledSync;
