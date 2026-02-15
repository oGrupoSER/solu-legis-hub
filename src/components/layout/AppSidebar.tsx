import { useState } from "react";
import {
  LayoutDashboard, Clock, Activity, Search, TestTube, Scale, Shield,
  FileText, Settings, HelpCircle, Newspaper, Gavel, FolderInput,
  AlertCircle, Building2, Users, RotateCcw, ChevronDown, Bookmark,
  ArrowRightLeft, ListChecks,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SubItem {
  title: string;
  url: string;
  icon: any;
}

interface ServiceGroup {
  title: string;
  icon: any;
  basePath: string;
  items: SubItem[];
}

const serviceGroups: ServiceGroup[] = [
  {
    title: "Publicações",
    icon: Newspaper,
    basePath: "/publications",
    items: [
      { title: "Termos", url: "/publications/terms", icon: Bookmark },
      { title: "Recortes", url: "/publications", icon: Newspaper },
    ],
  },
  {
    title: "Distribuições",
    icon: FolderInput,
    basePath: "/distributions",
    items: [
      { title: "Nomes Monitorados", url: "/distributions/terms", icon: Search },
      { title: "Distribuições", url: "/distributions", icon: FolderInput },
    ],
  },
  {
    title: "Processos",
    icon: Gavel,
    basePath: "/processes",
    items: [
      { title: "Processos CNJ", url: "/processes", icon: Gavel },
      { title: "Andamentos", url: "/processes/movements", icon: ListChecks },
    ],
  },
];

const integrationItems = [
  { title: "Status Tribunais", url: "/court-status", icon: AlertCircle },
  { title: "Reversão Confirmações", url: "/confirmation-reversal", icon: RotateCcw },
  { title: "Logs de Sincronização", url: "/sync-logs", icon: Clock },
];

const registrationItems = [
  { title: "Parceiros", url: "/partners", icon: Building2 },
  { title: "Clientes", url: "/clients", icon: Users },
];

const systemItems = [
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
    // Exact match for leaf routes to avoid collisions like /publications vs /publications/terms
    return location.pathname === path;
  };

  const isGroupActive = (basePath: string) => {
    return location.pathname.startsWith(basePath);
  };

  const getNavCls = (path: string) =>
    isActive(path)
      ? "bg-primary/10 text-primary font-medium hover:bg-primary/20"
      : "hover:bg-muted/50";

  const renderItems = (items: { title: string; url: string; icon: any }[]) => (
    <SidebarMenu>
      {items.map((item) => (
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
  );

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

        {/* Dashboard */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" end className={getNavCls("/")}>
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Services with collapsible submenus */}
        <SidebarGroup>
          <SidebarGroupLabel>Serviços</SidebarGroupLabel>
          <SidebarGroupContent>
            {serviceGroups.map((group) => (
              <Collapsible key={group.basePath} defaultOpen={isGroupActive(group.basePath)}>
                <CollapsibleTrigger className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                  isGroupActive(group.basePath) ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}>
                  <group.icon className="h-4 w-4 shrink-0" />
                  {open && (
                    <>
                      <span className="flex-1 text-left">{group.title}</span>
                      <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                    </>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenu className="ml-4 border-l border-border pl-2 mt-1">
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.url} end className={getNavCls(item.url)}>
                            <item.icon className="h-3.5 w-3.5" />
                            <span className="text-sm">{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Integration */}
        <SidebarGroup>
          <SidebarGroupLabel>Integração</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(integrationItems)}</SidebarGroupContent>
        </SidebarGroup>

        {/* Registration */}
        <SidebarGroup>
          <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(registrationItems)}</SidebarGroupContent>
        </SidebarGroup>

        {/* System */}
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>{renderItems(systemItems)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
