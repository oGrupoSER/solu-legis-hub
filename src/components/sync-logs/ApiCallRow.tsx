import { useState } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Globe, Clock } from "lucide-react";
import { format } from "date-fns";
import { HttpStatusBadge, MethodBadge } from "./StatusBadges";
import { ApiCallDetailPanel } from "./ApiCallDetailPanel";

export interface ApiCallLog {
  id: string;
  sync_log_id: string | null;
  partner_service_id: string | null;
  call_type: string;
  method: string;
  url: string;
  request_headers: Record<string, string> | null;
  request_body: string | null;
  response_status: number | null;
  response_status_text: string | null;
  response_headers: Record<string, string> | null;
  response_summary: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

interface ApiCallRowProps {
  call: ApiCallLog;
}

export const ApiCallRow = ({ call }: ApiCallRowProps) => {
  const [expanded, setExpanded] = useState(false);

  // Extract just the endpoint path from URL
  const getEndpoint = (url: string) => {
    try {
      const u = new URL(url);
      const path = u.pathname.split('/').pop() || u.pathname;
      return path;
    } catch {
      return url;
    }
  };

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8 px-2">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        </TableCell>
        <TableCell>
          <MethodBadge method={call.method} callType={call.call_type} />
        </TableCell>
        <TableCell className="font-mono text-xs max-w-[300px] truncate" title={call.url}>
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{getEndpoint(call.url)}</span>
          </div>
        </TableCell>
        <TableCell>
          <HttpStatusBadge status={call.response_status} />
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {format(new Date(call.created_at), "HH:mm:ss")}
        </TableCell>
        <TableCell>
          {call.duration_ms != null ? (
            <div className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {call.duration_ms}ms
            </div>
          ) : "-"}
        </TableCell>
        <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">
          {call.response_summary || call.error_message || "-"}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="p-0 bg-muted/30">
            <ApiCallDetailPanel call={call} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
