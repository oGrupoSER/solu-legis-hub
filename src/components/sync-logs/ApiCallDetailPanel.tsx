import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ApiCallLog } from "./ApiCallRow";

interface ApiCallDetailPanelProps {
  call: ApiCallLog;
}

export const ApiCallDetailPanel = ({ call }: ApiCallDetailPanelProps) => {
  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const isXml = (str: string) => str.trim().startsWith('<?xml') || str.trim().startsWith('<');

  return (
    <div className="p-4 space-y-3">
      {/* URL completa */}
      <div>
        <span className="text-xs font-semibold text-muted-foreground uppercase">URL Completa</span>
        <div className="mt-1 font-mono text-xs bg-background p-2 rounded border break-all">
          {call.url}
        </div>
      </div>

      {call.error_message && (
        <div>
          <span className="text-xs font-semibold text-destructive uppercase">Erro</span>
          <div className="mt-1 text-sm text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
            {call.error_message}
          </div>
        </div>
      )}

      <Tabs defaultValue="request" className="w-full">
        <TabsList className="h-8">
          <TabsTrigger value="request" className="text-xs h-7">Request</TabsTrigger>
          <TabsTrigger value="response" className="text-xs h-7">Response</TabsTrigger>
          <TabsTrigger value="headers" className="text-xs h-7">Headers</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="mt-2">
          {call.request_body ? (
            <ScrollArea className="h-[300px]">
              <pre className="font-mono text-xs bg-background p-3 rounded border whitespace-pre-wrap break-all">
                {isXml(call.request_body) ? call.request_body : (() => {
                  try { return JSON.stringify(JSON.parse(call.request_body!), null, 2); } catch { return call.request_body; }
                })()}
              </pre>
            </ScrollArea>
          ) : (
            <div className="text-sm text-muted-foreground p-3">Sem corpo de requisição (GET)</div>
          )}
        </TabsContent>

        <TabsContent value="response" className="mt-2">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold">Status:</span>
              <span>{call.response_status} {call.response_status_text}</span>
              {call.duration_ms != null && (
                <>
                  <span className="font-semibold ml-4">Duração:</span>
                  <span>{call.duration_ms}ms</span>
                </>
              )}
            </div>
            {call.response_summary && (
              <div className="text-sm bg-background p-2 rounded border">
                <span className="font-semibold">Resumo: </span>{call.response_summary}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="headers" className="mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Request Headers</span>
              {call.request_headers ? (
                <pre className="font-mono text-xs bg-background p-3 rounded border mt-1 whitespace-pre-wrap">
                  {formatJson(call.request_headers)}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground p-2">-</div>
              )}
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Response Headers</span>
              {call.response_headers ? (
                <pre className="font-mono text-xs bg-background p-3 rounded border mt-1 whitespace-pre-wrap">
                  {formatJson(call.response_headers)}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground p-2">-</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
