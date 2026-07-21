import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWorkflowRuns } from "@/lib/workflows.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function RunHistoryDrawer({ workflowId, open, onOpenChange }: {
  workflowId: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const list = useServerFn(listWorkflowRuns);
  const { data: runs = [] } = useQuery({
    queryKey: ["workflow-runs", workflowId],
    queryFn: () => list({ data: { workflowId, limit: 50 } }),
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-none overflow-y-auto">
        <SheetHeader><SheetTitle>Execution log</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-2">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
          {(runs as any[]).map((r: any) => (
            <div key={r.id} className="border rounded p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <Badge variant={r.status === "completed" ? "default" : r.status === "errored" ? "destructive" : "secondary"}>
                  {r.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(r.started_at), "PPp")}</span>
              </div>
              <div className="text-xs">
                Workflow ran on <b>{r.contacts_matched}</b> contacts, <b>{r.errors}</b> errors
                <span className="text-muted-foreground"> · source: {r.trigger_source}</span>
              </div>
              {Array.isArray(r.error_log) && r.error_log.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Error details</summary>
                  <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto text-[10px]">{JSON.stringify(r.error_log, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
