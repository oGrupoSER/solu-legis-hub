import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle,
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    setShowDeleteDialog(false);

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
    <>
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

          <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle>Excluir Termo</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a excluir o termo <strong className="text-foreground">"{term.term}"</strong>.
              </p>
              {term.solucionare_code && (
                <p className="text-destructive/80">
                  Este termo também será removido do parceiro Solucionare. Esta ação não pode ser desfeita.
                </p>
              )}
              {!term.solucionare_code && (
                <p>
                  O termo será removido apenas localmente. Esta ação não pode ser desfeita.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Termo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
