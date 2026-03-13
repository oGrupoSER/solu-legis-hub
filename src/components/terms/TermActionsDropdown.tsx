import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Loader2,
} from "lucide-react";

interface TermActionsDropdownProps {
  term: {
    id: string;
    term: string;
    term_type: string;
    is_active: boolean;
    partner_service_id: string | null;
    solucionare_code: number | null;
  };
  onEdit: () => void;
  onRefresh: () => void;
}

export function TermActionsDropdown({
  term,
  onEdit,
  onRefresh,
}: TermActionsDropdownProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Removed handleAction - no longer needed (activate/deactivate removed)

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este termo? Esta ação não pode ser desfeita.")) {
      return;
    }

    if (term.partner_service_id) {
      const action = term.term_type === "name" ? "excluir_nome" : "desativar_escritorio";
      await handleAction(action);
    } else {
      // Local delete only
      try {
        const { error } = await supabase.from("search_terms").delete().eq("id", term.id);
        if (error) throw error;
        toast.success("Termo excluído com sucesso");
        onRefresh();
      } catch (error) {
        toast.error("Erro ao excluir termo");
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {term.is_active ? (
          <DropdownMenuItem
            onClick={() =>
              handleAction(term.term_type === "name" ? "desativar_nome" : "desativar_escritorio")
            }
          >
            <PowerOff className="mr-2 h-4 w-4" />
            Desativar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              handleAction(term.term_type === "name" ? "ativar_nome" : "ativar_escritorio")
            }
          >
            <Power className="mr-2 h-4 w-4" />
            Ativar
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
