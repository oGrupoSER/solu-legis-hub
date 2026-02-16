import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, UserX } from "lucide-react";

interface ClientBadgesProps {
  clients: string[];
  label?: string;
}

export function ClientBadges({ clients, label = "Clientes vinculados" }: ClientBadgesProps) {
  const [open, setOpen] = useState(false);

  if (clients.length === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground border-dashed cursor-default">
        <UserX className="h-3 w-3" />
        Nenhum
      </Badge>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 h-7 px-2 text-xs font-medium"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Users className="h-3.5 w-3.5 text-primary" />
        <span>{clients.length} cliente{clients.length > 1 ? "s" : ""}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {label}
            </DialogTitle>
            <DialogDescription>
              {clients.length} cliente{clients.length > 1 ? "s" : ""} vinculado{clients.length > 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {clients.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/30"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium">{name}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
