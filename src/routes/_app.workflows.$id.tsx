import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWorkflow } from "@/lib/workflows.functions";
import { WorkflowBuilder } from "@/components/workflows/builder/WorkflowBuilder";

export const Route = createFileRoute("/_app/workflows/$id")({ component: WorkflowDetail });

function WorkflowDetail() {
  const { id } = Route.useParams();
  const fetchWorkflow = useServerFn(getWorkflow);
  const { data: wf, isLoading, error } = useQuery({
    queryKey: ["workflow", id],
    queryFn: () => fetchWorkflow({ data: { id } }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading workflow…</div>;
  if (error || !wf) return <div className="p-8 text-destructive">Failed to load workflow.</div>;

  return (
    <WorkflowBuilder
      workflow={{
        id: (wf as any).id,
        name: (wf as any).name,
        enabled: !!(wf as any).enabled,
        definition: (wf as any).definition ?? { nodes: [], edges: [] },
      }}
    />
  );
}
