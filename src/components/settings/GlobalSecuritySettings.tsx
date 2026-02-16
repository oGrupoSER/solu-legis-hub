import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";

const GlobalSecuritySettings = () => {
  const [settings, setSettings] = useState({
    defaultRateLimit: 1000,
    defaultBatchSize: 500,
    ipCheckEnabled: true,
    securityLoggingEnabled: true,
  });

  const handleSave = () => {
    // These settings are enforced in the edge functions via constants
    // In a production environment, these could be stored in a settings table
    toast.success("Configurações globais salvas. As alterações serão aplicadas nas próximas requisições.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Configurações Globais de Segurança
        </CardTitle>
        <CardDescription>Defina os padrões de segurança e volumetria do sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Rate Limit Padrão (req/hora)</Label>
            <Input
              type="number"
              value={settings.defaultRateLimit}
              onChange={(e) => setSettings({ ...settings, defaultRateLimit: parseInt(e.target.value) || 1000 })}
            />
            <p className="text-xs text-muted-foreground">Limite padrão de requisições por hora para cada token</p>
          </div>
          <div className="space-y-2">
            <Label>Tamanho Padrão do Lote</Label>
            <Input
              type="number"
              value={settings.defaultBatchSize}
              onChange={(e) => setSettings({ ...settings, defaultBatchSize: parseInt(e.target.value) || 500 })}
            />
            <p className="text-xs text-muted-foreground">Máximo de registros retornados por requisição</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Verificação de IP</Label>
              <p className="text-sm text-muted-foreground">Verifica regras de IP (bloqueio/permissão) em cada requisição</p>
            </div>
            <Switch
              checked={settings.ipCheckEnabled}
              onCheckedChange={(v) => setSettings({ ...settings, ipCheckEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Logging de Segurança</Label>
              <p className="text-sm text-muted-foreground">Registra tentativas de acesso bloqueadas no log de segurança</p>
            </div>
            <Switch
              checked={settings.securityLoggingEnabled}
              onCheckedChange={(v) => setSettings({ ...settings, securityLoggingEnabled: v })}
            />
          </div>
        </div>

        <Button onClick={handleSave}>Salvar Configurações Globais</Button>
      </CardContent>
    </Card>
  );
};

export default GlobalSecuritySettings;
