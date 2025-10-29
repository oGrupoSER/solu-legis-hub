import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { Bell, Clock, Mail, Shield, Zap } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const [settings, setSettings] = useState({
    autoSync: true,
    syncInterval: "60",
    emailNotifications: true,
    webhookNotifications: true,
    errorAlerts: true,
    dailySummary: false,
    darkMode: false,
    compactView: false,
  });

  const handleSave = () => {
    toast.success("Configurações salvas com sucesso");
  };

  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Configurações" },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">
          Configure as preferências e comportamentos do sistema
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Preferências Gerais
              </CardTitle>
              <CardDescription>
                Configure as preferências básicas do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativa o tema escuro da interface
                  </p>
                </div>
                <Switch
                  checked={settings.darkMode}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, darkMode: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Visualização Compacta</Label>
                  <p className="text-sm text-muted-foreground">
                    Mostra mais informações por tela
                  </p>
                </div>
                <Switch
                  checked={settings.compactView}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, compactView: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Sincronização Automática
              </CardTitle>
              <CardDescription>
                Configure o comportamento das sincronizações automáticas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar Sincronização Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Sincroniza dados automaticamente em intervalos regulares
                  </p>
                </div>
                <Switch
                  checked={settings.autoSync}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, autoSync: checked })
                  }
                />
              </div>

              {settings.autoSync && (
                <div className="space-y-2">
                  <Label htmlFor="interval">Intervalo de Sincronização (minutos)</Label>
                  <Select
                    value={settings.syncInterval}
                    onValueChange={(value) =>
                      setSettings({ ...settings, syncInterval: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="120">2 horas</SelectItem>
                      <SelectItem value="360">6 horas</SelectItem>
                      <SelectItem value="720">12 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Preferências de Notificação
              </CardTitle>
              <CardDescription>
                Escolha como deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba notificações importantes por email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, emailNotifications: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificações via Webhook</Label>
                  <p className="text-sm text-muted-foreground">
                    Envie notificações para sistemas externos
                  </p>
                </div>
                <Switch
                  checked={settings.webhookNotifications}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, webhookNotifications: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alertas de Erro</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba alertas imediatos quando ocorrer um erro
                  </p>
                </div>
                <Switch
                  checked={settings.errorAlerts}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, errorAlerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Resumo Diário</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba um resumo diário das atividades
                  </p>
                </div>
                <Switch
                  checked={settings.dailySummary}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, dailySummary: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Segurança
              </CardTitle>
              <CardDescription>
                Gerencie configurações de segurança e acesso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email de Contato</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Logs de Auditoria</Label>
                <p className="text-sm text-muted-foreground">
                  Todos os acessos e modificações são registrados automaticamente
                </p>
                <Button variant="outline" className="mt-2">
                  Ver Logs de Auditoria
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancelar</Button>
        <Button onClick={handleSave}>Salvar Configurações</Button>
      </div>
    </div>
  );
};

export default Settings;
