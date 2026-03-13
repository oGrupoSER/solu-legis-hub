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

    setIsLoading(true);

    try {
      if (term.partner_service_id && term.solucionare_code) {
        // Delete via REST V2 API (nome_excluir)
        const { data, error } = await supabase.functions.invoke("manage-search-terms", {
          body: {
            service_id: term.partner_service_id,
            action: "excluir_nome_rest",
            data: {
              cod_nome: term.solucionare_code,
              term_id: term.id,
            },
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
      } else {
        // Local delete only
        const { error } = await supabase.from("search_terms").delete().eq("id", term.id);
        if (error) throw error;
      }

      toast.success("Termo excluído com sucesso");
      onRefresh();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Erro ao excluir termo");
    } finally {
      setIsLoading(false);
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

        <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
