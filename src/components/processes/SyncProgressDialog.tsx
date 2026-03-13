import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type StageStatus = "pending" | "running" | "success" | "error";

interface SyncStage {
  id: string;
  label: string;
  status: StageStatus;
  result?: string;
}

const INITIAL_STAGES: Omit<SyncStage, "status">[] = [
  { id: "send-pending", label: "Enviando processos pendentes" },
  { id: "sync-status", label: "Atualizando status dos processos" },
  { id: "groupers", label: "Buscando agrupadores" },
  { id: "movements", label: "Buscando novos andamentos" },
  { id: "all-movements", label: "Buscando todos andamentos por processo" },
  { id: "documents", label: "Buscando documentos" },
  { id: "covers", label: "Atualizando capas dos processos" },
  { id: "dependencies", label: "Buscando dependências" },
];

interface SyncProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function SyncProgressDialog({ open, onOpenChange, onComplete }: SyncProgressDialogProps) {
  const [stages, setStages] = useState<SyncStage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const updateStage = useCallback((id: string, status: StageStatus, result?: string) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, status, result } : s));
  }, []);

  const runSync = useCallback(async () => {
    setIsRunning(true);
    setCompleted(false);
    setStages(INITIAL_STAGES.map(s => ({ ...s, status: "pending" as StageStatus })));

    // Stage 1: Send pending
    updateStage("send-pending", "running");
    try {
      const { data } = await supabase.functions.invoke("sync-process-management", {
        body: { action: "send-pending" },
      });
      updateStage("send-pending", "success", `${data?.sent || 0} enviados`);
    } catch {
      updateStage("send-pending", "error", "Falha ao enviar");
    }

    // Stage 2: Sync status
    updateStage("sync-status", "running");
    try {
      const { data, error } = await supabase.functions.invoke("sync-process-management", {
        body: { action: "sync" },
      });
      if (error) throw error;
      updateStage("sync-status", "success", `${data?.synced || 0} atualizados`);
    } catch {
      updateStage("sync-status", "error", "Falha ao atualizar status");
    }

    // Stages 3-7: sync-process-updates individual types
    const updateStages: { id: string; syncType: string }[] = [
      { id: "groupers", syncType: "groupers" },
      { id: "movements", syncType: "movements" },
      { id: "documents", syncType: "documents" },
      { id: "covers", syncType: "covers" },
      { id: "dependencies", syncType: "dependencies" },
    ];

    for (const stage of updateStages) {
      updateStage(stage.id, "running");
      try {
        const { data, error } = await supabase.functions.invoke("sync-process-updates", {
          body: { syncType: stage.syncType },
        });
        if (error) throw error;
        const count = data?.results?.[0]?.recordsSynced || 0;
        updateStage(stage.id, "success", `${count} registros`);
      } catch {
        updateStage(stage.id, "error", "Falha");
      }
    }

    setIsRunning(false);
    setCompleted(true);
    onComplete();
  }, [updateStage, onComplete]);

  useEffect(() => {
    if (open && !isRunning && !completed) {
      runSync();
    }
  }, [open]);

  const handleClose = () => {
    if (!isRunning) {
      setCompleted(false);
      onOpenChange(false);
    }
  };

  const statusIcon = (status: StageStatus) => {
    switch (status) {
      case "pending": return <Circle className="h-5 w-5 text-muted-foreground/40" />;
      case "running": return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case "success": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "error": return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const hasErrors = stages.some(s => s.status === "error");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={e => isRunning && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRunning && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {completed && !hasErrors && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            {completed && hasErrors && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            Sincronização de Processos
          </DialogTitle>
          <DialogDescription>
            {isRunning ? "Executando sincronização..." : completed ? "Sincronização concluída" : "Preparando..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-4">
          {stages.map((stage, idx) => (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                stage.status === "running" && "bg-primary/5",
                stage.status === "success" && "bg-emerald-500/5",
                stage.status === "error" && "bg-destructive/5",
              )}
            >
              {statusIcon(stage.status)}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  stage.status === "pending" && "text-muted-foreground",
                  stage.status === "running" && "text-foreground",
                  stage.status === "success" && "text-foreground",
                  stage.status === "error" && "text-destructive",
                )}>
                  {stage.label}
                </p>
              </div>
              {stage.result && (
                <span className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  stage.status === "success" && "text-emerald-600",
                  stage.status === "error" && "text-destructive",
                )}>
                  {stage.result}
                </span>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} disabled={isRunning} className="w-full">
            {isRunning ? "Aguarde..." : "Fechar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
