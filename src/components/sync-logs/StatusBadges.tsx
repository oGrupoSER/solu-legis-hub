import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2 } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; label: string }> = {
  success: { variant: "default", icon: CheckCircle2, label: "SUCCESS" },
  error: { variant: "destructive", icon: XCircle, label: "ERROR" },
  in_progress: { variant: "secondary", icon: Loader2, label: "EM EXECUÇÃO" },
  running: { variant: "secondary", icon: Clock, label: "RUNNING" },
  pending: { variant: "outline", icon: AlertCircle, label: "PENDENTE" },
};

export const SyncStatusBadge = ({ status }: StatusBadgeProps) => {
  const config = variants[status] || variants.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
};

interface HttpStatusBadgeProps {
  status?: number | null;
}

export const HttpStatusBadge = ({ status }: HttpStatusBadgeProps) => {
  if (!status) return <span className="text-muted-foreground">-</span>;
  
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  if (status >= 400) variant = "destructive";
  else if (status >= 300) variant = "outline";
  else if (status >= 200) variant = "default";

  return <Badge variant={variant}>{status}</Badge>;
};

interface MethodBadgeProps {
  method: string;
  callType: string;
}

export const MethodBadge = ({ method, callType }: MethodBadgeProps) => {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    POST: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    PUT: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    DELETE: "bg-red-500/10 text-red-500 border-red-500/20",
    SOAP: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  const display = callType === 'SOAP' ? 'SOAP' : method;
  const colorClass = colors[callType === 'SOAP' ? 'SOAP' : method] || colors.GET;

  return (
    <Badge variant="outline" className={`font-mono text-xs ${colorClass}`}>
      {display}
    </Badge>
  );
};
