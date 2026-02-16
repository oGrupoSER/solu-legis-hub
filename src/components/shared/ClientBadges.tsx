import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, UserX } from "lucide-react";

interface ClientBadgesProps {
  clients: string[];
  maxVisible?: number;
}

export function ClientBadges({ clients, maxVisible = 2 }: ClientBadgesProps) {
  if (clients.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="gap-1 text-muted-foreground border-dashed">
              <UserX className="h-3 w-3" />
              Nenhum
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Nenhum cliente vinculado</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const visible = clients.slice(0, maxVisible);
  const remaining = clients.slice(maxVisible);

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((name) => (
        <Badge key={name} variant="secondary" className="gap-1 text-xs font-normal">
          <Users className="h-3 w-3 shrink-0" />
          {name}
        </Badge>
      ))}
      {remaining.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-xs">
                +{remaining.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-0.5">
                {remaining.map((n) => (
                  <div key={n}>{n}</div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
