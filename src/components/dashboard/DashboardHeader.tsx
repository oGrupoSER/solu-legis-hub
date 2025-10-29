import { Button } from "@/components/ui/button";
import { Scale, Shield, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const DashboardHeader = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso");
      navigate("/auth");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  return (
    <header className="border-b border-border bg-card sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" />
            <Shield className="h-7 w-7 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Hub Jurídico</h1>
            <p className="text-xs text-muted-foreground">Sistema de Integração de Dados Processuais</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
};
