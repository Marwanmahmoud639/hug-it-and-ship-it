import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Zap, Play, Pencil, Trash2, Copy as CopyIcon, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  listWorkflows,
  saveWorkflow,
  deleteWorkflow,
  runWorkflowNow,
  exportWorkflow,
  importWorkflow,
} from "@/lib/workflows.functions";
import { JSONBoard, PasteJSONDialog } from "@/components/automations/JSONBoard";

export const Route = createFileRoute("/_app/automations")({ component: AutomationsPage });

type Workflow = {
  id: string;
  name: string;
  status: string;
  trigger_type: string;
  trigger_config: any;
  steps: any;
  stop_conditions: any;
  last_run_at: string | null;
  _counts?: { running: number; completed: number };
};

function fmtTime(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function AutomationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listWorkflows);
  const save = useServerFn(saveWorkflow);
  const del = useServerFn(deleteWorkflow);
  const run = useServerFn(runWorkflowNow);
  const exp = useServerFn(exportWorkflow);
  const imp = useServerFn(importWorkflow);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => list() as Promise<Workflow[]>,
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [jsonCache, setJsonCache] = useState<Record<string, string>>({});

  const toggleMut = useMutation({
    mutationFn: (w: Workflow) =>
      save({ data: { ...w, status: w.status === "active" ? "paused" : "active" } as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Deleted");
    },
  });
  const runMut = useMutation({
    mutationFn: (id: string) => run({ data: { id } }),
    onSuccess: (r: any) => toast.success(`Run started — matched ${r.matched} contact(s)`),
    onError: (e: any) => toast.error(e.message),
  });
  const importMut = useMutation({
    mutationFn: (json: string) => imp({ data: { json } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflows"] }),
  });
  const duplicateMut = useMutation({
    mutationFn: async (w: Workflow) => {
      const json = await exp({ data: { id: w.id } });
      const parsed = JSON.parse(json);
      parsed.name = `${parsed.name} (copy)`;
      return imp({ data: { json: JSON.stringify(parsed) } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Duplicated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleJson = async (w: Workflow) => {
    const next = !expanded[w.id];
    setExpanded((p) => ({ ...p, [w.id]: next }));
    if (next && !jsonCache[w.id]) {
      try {
        const json = await exp({ data: { id: w.id } });
        setJsonCache((p) => ({ ...p, [w.id]: json }));
      } catch (e: any) {
        toast.error(e.message);
      }
    }
  };

  return (
    <div className="container max-w-6xl py-8 px-4">
      <div className="flex items-start justify-between mb-6 gap-2 flex-wrap">
        <PageHeader
          title="Automations"
          subtitle="Trigger-based workflows that run automatically when leads do things."
        />
        <div className="flex items-center gap-2">
          <PasteJSONDialog onImport={async (json) => { await importMut.mutateAsync(json); }} />
          <Button onClick={() => navigate({ to: "/workflows" })}>
            <Zap className="w-4 h-4 mr-1" /> New automation
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="json">JSON Board</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          {isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : workflows.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No automations yet"
              body="Create one from the Workflows builder, or paste JSON to import."
            />
          ) : (
            <div className="grid gap-3">
              {workflows.map((w) => (
                <Card key={w.id} className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <button
                      className="min-w-0 text-left flex items-center gap-2"
                      onClick={() => toggleJson(w)}
                    >
                      {expanded[w.id] ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{w.name}</h3>
                          <Badge variant={w.status === "active" ? "default" : "secondary"}>
                            {w.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Trigger: <code>{w.trigger_type}</code> ·{" "}
                          {Array.isArray(w.steps) ? w.steps.length : 0} step(s) · Last run:{" "}
                          {fmtTime(w.last_run_at)}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={w.status === "active"}
                        onCheckedChange={() => toggleMut.mutate(w)}
                        aria-label="Enable"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => runMut.mutate(w.id)}
                        disabled={runMut.isPending}
                      >
                        <Play className="w-4 h-4 mr-1" /> Run now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate({ to: "/workflows/$id", params: { id: w.id } })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => duplicateMut.mutate(w)}
                        disabled={duplicateMut.isPending}
                      >
                        <CopyIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete "${w.name}"?`)) delMut.mutate(w.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {expanded[w.id] && (
                    <div className="mt-3">
                      {jsonCache[w.id] ? (
                        <JSONBoard value={jsonCache[w.id]} filename={w.name.replace(/\s+/g, "_")} />
                      ) : (
                        <div className="text-xs text-muted-foreground">Loading JSON…</div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-4">
          {workflows.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="Nothing to export"
              body="Create an automation first."
            />
          ) : (
            <div className="grid gap-4">
              {workflows.map((w) => {
                const compact = {
                  name: w.name,
                  trigger: { type: w.trigger_type, ...(w.trigger_config || {}) },
                  blocks: w.steps ?? [],
                  stop_conditions: w.stop_conditions ?? [],
                };
                return (
                  <div key={w.id}>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm">{w.name}</h3>
                      <Badge variant={w.status === "active" ? "default" : "secondary"}>
                        {w.status}
                      </Badge>
                    </div>
                    <JSONBoard value={compact} filename={w.name.replace(/\s+/g, "_")} />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
