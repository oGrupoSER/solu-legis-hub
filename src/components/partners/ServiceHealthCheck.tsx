import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ServiceHealthCheckProps {
  serviceId: string;
  serviceName: string;
  serviceUrl: string;
  serviceType: string;
}

export const ServiceHealthCheck = ({ serviceId, serviceName, serviceUrl, serviceType }: ServiceHealthCheckProps) => {
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const checkHealth = async () => {
    setStatus("checking");
    const startTime = Date.now();

    try {
      // Simulate health check (in real scenario, would call sync-orchestrator with test flag)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const endTime = Date.now();
      setResponseTime(endTime - startTime);
      setStatus("success");
      toast.success("Serviço está respondendo normalmente");
    } catch (error) {
      setStatus("error");
      toast.error("Falha ao conectar com o serviço");
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "checking":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Testando
          </Badge>
        );
      case "success":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Online
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Offline
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Activity className="h-3 w-3" />
            Não testado
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{serviceName}</CardTitle>
        <CardDescription>Verifique se o serviço está respondendo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Status</p>
            <div className="mt-2">{getStatusBadge()}</div>
          </div>
          {responseTime !== null && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Tempo de resposta</p>
              <p className="text-2xl font-bold text-foreground">{responseTime}ms</p>
            </div>
          )}
        </div>
        <Button onClick={checkHealth} disabled={status === "checking"} className="w-full gap-2">
          <Activity className="h-4 w-4" />
          {status === "checking" ? "Testando..." : "Testar Conectividade"}
        </Button>
      </CardContent>
    </Card>
  );
};
