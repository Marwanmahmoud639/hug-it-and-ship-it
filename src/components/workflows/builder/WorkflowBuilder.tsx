import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges, useReactFlow,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BlockPalette } from "./BlockPalette";
import { BlockConfigPanel } from "./BlockConfigPanel";
import { NODE_TYPES } from "./nodes";
import { BLOCK_DEFS, getBlockDef } from "./block-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Play, Upload, Download, History } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveWorkflowDefinition, runWorkflowNow, exportWorkflow, importWorkflow } from "@/lib/workflows.functions";
import { RunHistoryDrawer } from "../RunHistoryDrawer";

type Props = {
  workflow: {
    id: string;
    name: string;
    enabled: boolean;
    definition: { nodes?: Node[]; edges?: Edge[]; viewport?: any };
  };
};

export function WorkflowBuilder({ workflow }: Props) {
  return (
    <ReactFlowProvider>
      <Inner workflow={workflow} />
    </ReactFlowProvider>
  );
}

function Inner({ workflow }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveWorkflowDefinition);
  const runNow = useServerFn(runWorkflowNow);
  const exportFn = useServerFn(exportWorkflow);
  const importFn = useServerFn(importWorkflow);

  const [name, setName] = useState(workflow.name);
  const [enabled, setEnabled] = useState(workflow.enabled);
  const [nodes, setNodes] = useState<Node[]>(workflow.definition?.nodes ?? []);
  const [edges, setEdges] = useState<Edge[]>(workflow.definition?.edges ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();

  const selected = useMemo(() => nodes.find(n => n.id === selectedId) ?? null, [nodes, selectedId]);

  const onNodesChange = useCallback((c: NodeChange[]) => setNodes(ns => applyNodeChanges(c, ns)), []);
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges(es => applyEdgeChanges(c, es)), []);
  const onConnect = useCallback((conn: Connection) => setEdges(es => addEdge({ ...conn, animated: true }, es)), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockId = e.dataTransfer.getData("application/lovable-block");
    const def = getBlockDef(blockId);
    if (!def) return;
    if (def.category === "trigger" && nodes.some(n => (n.data as any).blockId?.startsWith("trigger."))) {
      toast.error("Only one trigger per workflow");
      return;
    }
    const bounds = dropRef.current!.getBoundingClientRect();
    const position = rf.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setNodes(ns => [...ns, {
      id, type: def.category, position,
      data: { blockId: def.id, config: { ...def.defaultConfig } },
    }]);
    setSelectedId(id);
  }, [nodes, rf]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const updateConfig = (cfg: Record<string, any>) => {
    if (!selectedId) return;
    setNodes(ns => ns.map(n => n.id === selectedId ? { ...n, data: { ...n.data, config: cfg } } : n));
  };

  const deleteNode = (id: string) => {
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.source !== id && e.target !== id));
    setSelectedId(null);
  };

  const saveMut = useMutation({
    mutationFn: () => save({
      data: { id: workflow.id, name, enabled, definition: { nodes, edges, viewport: rf.getViewport() } },
    }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["workflows"] }); },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const runMut = useMutation({
    mutationFn: () => runNow({ data: { id: workflow.id } }),
    onSuccess: (r: any) => toast.success(`Queued ${r.matched ?? 0} contacts`),
    onError: (e: any) => toast.error(e.message || "Run failed"),
  });

  const handleExport = async () => {
    const json = await exportFn({ data: { id: workflow.id } });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `workflow-${name || workflow.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const json = await file.text();
    try {
      const w = await importFn({ data: { json } });
      toast.success("Imported");
      navigate({ to: "/workflows/$id", params: { id: (w as any).id } });
    } catch (e: any) { toast.error(e.message || "Import failed"); }
  };

  // keyboard delete
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !(e.target as HTMLElement)?.matches?.("input,textarea")) {
        deleteNode(selectedId);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [selectedId]);

  return (
    <div className="fixed inset-0 flex flex-col bg-background z-30">
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/workflows" })}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm h-8 font-semibold" />
        <div className="flex items-center gap-2 ml-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} id="enabled" />
          <Label htmlFor="enabled" className="text-xs">{enabled ? "Enabled" : "Disabled"}</Label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="w-4 h-4 mr-1" /> Runs
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Import
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-1" /> Export</Button>
          <Button variant="outline" size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
            <Play className="w-4 h-4 mr-1" /> Run now
          </Button>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-[260px_1fr_320px] min-h-0">
        <BlockPalette />
        <div ref={dropRef} className="relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes} edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            defaultViewport={workflow.definition?.viewport ?? { x: 0, y: 0, zoom: 1 }}
            fitView={!workflow.definition?.viewport}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-muted-foreground">
                <div className="text-sm font-medium">Drag a trigger from the left to start</div>
                <div className="text-xs mt-1">Then connect actions, conditions, and delays.</div>
              </div>
            </div>
          )}
        </div>
        <BlockConfigPanel selected={selected} onChange={updateConfig} onDelete={deleteNode} />
      </div>

      <RunHistoryDrawer workflowId={workflow.id} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}
