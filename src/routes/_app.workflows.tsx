import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { GitBranch, Play, Pause, Trash2, Plus, Pencil } from "lucide-react";
import { listWorkflows, createFromTemplate, deleteWorkflow, saveWorkflow, createBlankWorkflow } from "@/lib/workflows.functions";
import { WORKFLOW_TEMPLATES } from "@/components/workflows/templates";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/workflows")({ component: Workflows });

function Workflows() {
  const navigate = useNavigate();
  const list = useServerFn(listWorkflows);
  const createTpl = useServerFn(createFromTemplate);
  const createBlank = useServerFn(createBlankWorkflow);
  const save = useServerFn(saveWorkflow);
  const del = useServerFn(deleteWorkflow);
  const qc = useQueryClient();
  const { data: workflows = [], isLoading } = useQuery({ queryKey: ["workflows"], queryFn: () => list() });

  const toBuilder = (id: string) => navigate({ to: "/workflows/$id", params: { id } });

  const blankMut = useMutation({
    mutationFn: () => createBlank({ data: { name: "Untitled workflow" } }),
    onSuccess: (w: any) => { qc.invalidateQueries({ queryKey: ["workflows"] }); toBuilder(w.id); },
    onError: (e: any) => toast.error(e.message),
  });
  const createMut = useMutation({
    mutationFn: (templateId: string) => createTpl({ data: { templateId } }),
    onSuccess: (w: any) => { qc.invalidateQueries({ queryKey: ["workflows"] }); toast.success("Created from template"); toBuilder(w.id); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workflows"] }); toast.success("Deleted"); },
  });
  const toggleMut = useMutation({
    mutationFn: (w: any) => save({ data: { ...w, status: w.status === "active" ? "paused" : "active" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });

  return (
    <div className="container max-w-6xl py-8 px-4">
      <div className="flex items-start justify-between mb-6">
        <PageHeader title="Workflows" subtitle="Behavioral automation that runs when leads do things" />
        <Button onClick={() => blankMut.mutate()} disabled={blankMut.isPending}>
          <Plus className="w-4 h-4 mr-1" /> Create Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : workflows.length === 0 ? (
        <EmptyState icon={GitBranch} title="No workflows yet" body="Start blank or pick a template below." />
      ) : (
        <div className="grid gap-3 mb-10">
          {workflows.map((w: any) => (
            <Card key={w.id} className="p-4 flex items-center justify-between">
              <button className="min-w-0 text-left flex-1" onClick={() => toBuilder(w.id)}>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate hover:underline">{w.name}</h3>
                  <Badge variant={w.status === "active" ? "default" : "secondary"}>{w.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Trigger: <code>{w.trigger_type}</code> · {(w.steps?.length ?? 0)} steps · {w._counts?.running ?? 0} running · {w._counts?.completed ?? 0} completed this month
                </div>
              </button>
              <div className="flex items-center gap-2">
                <Switch
                  checked={w.status === "active"}
                  onCheckedChange={() => toggleMut.mutate(w)}
                  aria-label="Toggle active"
                />
                {w.status === "active" ? <Play className="w-4 h-4 text-emerald-500" /> : <Pause className="w-4 h-4 text-muted-foreground" />}
                <Button variant="ghost" size="sm" onClick={() => toBuilder(w.id)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${w.name}"?`)) delMut.mutate(w.id); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3 mt-8">Start from a template</h2>
      <div className="grid md:grid-cols-3 gap-3">
        {Object.values(WORKFLOW_TEMPLATES).map(tpl => (
          <Card key={tpl.id} className="p-5">
            <div className="text-3xl mb-2">{tpl.icon}</div>
            <h3 className="font-semibold">{tpl.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">{tpl.description}</p>
            <div className="text-xs text-muted-foreground mb-4">{tpl.steps.length} steps</div>
            <Button size="sm" className="w-full" onClick={() => createMut.mutate(tpl.id)} disabled={createMut.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Use template
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
