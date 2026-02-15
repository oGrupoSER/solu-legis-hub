import { LayoutDashboard, Clock, Activity, Search, TestTube, Scale, Shield, FileText, Settings, HelpCircle, Newspaper, Gavel, FolderInput, AlertCircle, Building2, Users, RotateCcw } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Parceiros", url: "/partners", icon: Building2 },
  { title: "Clientes", url: "/clients", icon: Users },
  { title: "Processos", url: "/processes", icon: Gavel },
  { title: "Distribuições", url: "/distributions", icon: FolderInput },
  { title: "Publicações", url: "/publications", icon: Newspaper },
  { title: "Status Tribunais", url: "/court-status", icon: AlertCircle },
  { title: "Termos de Busca", url: "/search-terms", icon: Search },
  { title: "Reversão Confirmações", url: "/confirmation-reversal", icon: RotateCcw },
  { title: "Logs de Sincronização", url: "/sync-logs", icon: Clock },
  { title: "Monitoramento de API", url: "/api-monitoring", icon: Activity },
  { title: "Playground de API", url: "/api-testing", icon: TestTube },
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Ajuda", url: "/help", icon: HelpCircle },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const getNavCls = (path: string) =>
    isActive(path)
      ? "bg-primary/10 text-primary font-medium hover:bg-primary/20"
      : "hover:bg-muted/50";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="px-4 py-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Scale className="h-5 w-5 text-primary" />
              <Shield className="h-5 w-5 text-accent" />
            </div>
            {open && (
              <div>
                <h2 className="text-sm font-bold text-foreground">Hub Jurídico</h2>
                <p className="text-xs text-muted-foreground">Sistema Processual</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className={getNavCls(item.url)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
