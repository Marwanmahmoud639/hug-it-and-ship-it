import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Snowflake, Flame, GripVertical, Clock, Kanban as KanbanIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pipeline")({ component: Pipeline });

type Stage = { id: string; name: string; position: number; color: string };
type Lead = {
  id: string;
  stage_id: string | null;
  contact_id: string;
  gone_cold: boolean;
  auto_added?: boolean | null;
  last_contacted_at?: string | null;
  contacts?: { name: string; company: string | null; lead_score: number; title: string | null };
};

function relTime(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Pipeline() {
  const { team, role } = useAuth();
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [threshold, setThreshold] = useState<number>(70);
  const [dragId, setDragId] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const canEdit = role === "admin" || role === "manager";

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = async () => {
    if (!team?.id) return;
    const [s, l, ts] = await Promise.all([
      supabase.from("pipeline_stages").select("*").eq("team_id", team.id).order("position"),
      supabase.from("pipeline_leads").select("*, contacts(name, company, lead_score, title)").eq("team_id", team.id),
      supabase.from("team_settings").select("auto_pipeline_threshold").eq("team_id", team.id).maybeSingle(),
    ]);
    setStages((s.data ?? []) as Stage[]);
    setLeads((l.data ?? []) as Lead[]);
    if (ts.data?.auto_pipeline_threshold != null) setThreshold(ts.data.auto_pipeline_threshold);
  };

  useEffect(() => { load(); }, [team?.id]);

  useEffect(() => {
    if (!team?.id) return;
    const channel = supabase
      .channel(`pipeline-${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_leads", filter: `team_id=eq.${team.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [team?.id]);

  const activeLead = useMemo(() => leads.find(l => l.id === dragId) || null, [dragId, leads]);

  const onDragEnd = async (e: DragEndEvent) => {
    setDragId(null);
    const leadId = e.active.id as string;
    const stageId = e.over?.id as string | undefined;
    if (!stageId) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stage_id === stageId) return;
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, stage_id: stageId } : l)));
    const { error } = await supabase.from("pipeline_leads").update({ stage_id: stageId }).eq("id", leadId);
    if (error) { toast.error(error.message); load(); }
  };

  const addStage = async () => {
    if (!team?.id || !newStageName.trim()) return;
    const pos = stages.length ? Math.max(...stages.map(s => s.position)) + 1 : 0;
    const { error } = await supabase.from("pipeline_stages").insert({ team_id: team.id, name: newStageName.trim(), position: pos, color: "#2563EB" });
    if (error) return toast.error(error.message);
    setNewStageName(""); setAddingStage(false); load();
  };

  return (
    <div className="p-4 md:p-6 page-in">
      <PageHeader title="Pipeline" subtitle={`Drag leads through your funnel. Auto-add at score ≥ ${threshold}.`}>
        {canEdit && !addingStage && (
          <Button size="sm" variant="outline" onClick={() => setAddingStage(true)}>
            <Plus className="w-4 h-4 mr-1" />Add Stage
          </Button>
        )}
        {addingStage && (
          <div className="flex gap-2">
            <Input autoFocus value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="Stage name" className="h-9 w-48" onKeyDown={e => e.key === "Enter" && addStage()} />
            <Button size="sm" onClick={addStage}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingStage(false); setNewStageName(""); }}>Cancel</Button>
          </div>
        )}
      </PageHeader>

      {stages.length === 0 ? (
        <EmptyState icon={KanbanIcon} title="No stages set up" body="Default stages are created on signup. Refresh in a moment." />
      ) : (
        <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(e.active.id as string)} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map(s => (
              <StageColumn key={s.id} stage={s} leads={leads.filter(l => l.stage_id === s.id)} />
            ))}
          </div>
          <DragOverlay>
            {activeLead && <LeadCard lead={activeLead} overlay />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function StageColumn({ stage, leads }: { stage: Stage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const avg = leads.length
    ? Math.round(leads.reduce((sum, l) => sum + (l.contacts?.lead_score ?? 0), 0) / leads.length)
    : 0;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-w-[300px] w-[300px] bg-card border rounded-xl flex flex-col transition-all duration-200 shadow-card",
        isOver ? "border-primary bg-primary/[0.06] ring-2 ring-primary/20 ring-dashed" : "border-border",
      )}
    >
      <div
        className="rounded-t-xl border-b border-border px-3 pt-3 pb-2"
        style={{ borderTop: `3px solid ${stage.color || "#2563EB"}`, marginTop: -1 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate" style={{ fontFamily: "Sora" }}>{stage.name}</span>
            <Badge variant="secondary" className="text-[10px] rounded-full h-5 px-2">{leads.length}</Badge>
          </div>
          {leads.length > 0 && <span className="text-[10px] text-muted-foreground font-mono">avg {avg}</span>}
        </div>
      </div>

      <div className="space-y-2 p-3 flex-1 min-h-[120px]">
        {leads.length === 0 && (
          <div className="text-xs text-muted-foreground italic px-1 py-6 text-center border border-dashed border-border rounded-lg">
            Drop leads here
          </div>
        )}
        {leads.map(l => <LeadCard key={l.id} lead={l} />)}
        <button className="w-full mt-1 py-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity">
          <Plus className="w-3 h-3 inline mr-1" />Add lead
        </button>
      </div>
    </div>
  );
}

function LeadCard({ lead, overlay = false }: { lead: Lead; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const navigate = useNavigate();
  const score = lead.contacts?.lead_score ?? 0;
  const scoreColor = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-muted-foreground";
  const last = relTime(lead.last_contacted_at);
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={overlay ? undefined : () => navigate({ to: "/contacts/$id", params: { id: lead.contact_id } })}
      className={cn(
        "group relative bg-background border border-border rounded-lg p-4 text-sm cursor-pointer active:cursor-grabbing select-none transition-all",
        isDragging && !overlay ? "opacity-30" : "",
        overlay ? "shadow-card-hover rotate-2" : "hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-card-hover",
      )}
    >
      <GripVertical className="w-3.5 h-3.5 absolute right-2 top-2 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      {lead.auto_added && (
        <Badge className="absolute -top-2 left-3 h-4 px-1.5 text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-full">
          <Sparkles className="w-2.5 h-2.5 mr-0.5" />Auto
        </Badge>
      )}

      <div className="min-w-0">
        <div className="font-semibold truncate">{lead.contacts?.name || "Unknown"}</div>
        {lead.contacts?.company && <div className="text-xs text-muted-foreground truncate">{lead.contacts.company}</div>}
        {lead.contacts?.title && (
          <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            {lead.contacts.title}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold font-mono", scoreColor)}>{score}</span>
          {lead.gone_cold ? (
            <Snowflake className="w-3 h-3 text-cyan-400" />
          ) : score >= 80 ? (
            <Flame className="w-3 h-3 text-orange-400" />
          ) : null}
        </div>
        <div className={cn("flex items-center gap-1 text-[10px]", last ? "text-muted-foreground" : "text-amber-500")}>
          <Clock className="w-3 h-3" />{last ?? "Never contacted"}
        </div>
      </div>
    </div>
  );
}
