import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { WORKFLOW_TEMPLATES, type WorkflowTemplateId } from "@/components/workflows/templates";

const stepSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.string(), z.any()).default({}),
}).passthrough();

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  status: z.enum(["active", "paused", "draft"]).default("draft"),
  trigger_type: z.string().min(1),
  trigger_config: z.record(z.string(), z.any()).default({}),
  steps: z.array(stepSchema).default([]),
  stop_conditions: z.array(z.record(z.string(), z.any())).default([
    { type: "contact_replied" },
    { type: "opt_out_keyword" },
  ]),
  template_id: z.string().nullable().optional(),
});

// ----- Visual builder schema (definition jsonb) -----
const positionSchema = z.object({ x: z.number(), y: z.number() });
const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(["trigger", "action", "condition", "delay"]),
  position: positionSchema,
  data: z.object({
    blockId: z.string(),
    config: z.record(z.string(), z.any()).default({}),
  }).passthrough(),
}).passthrough();
const edgeSchema = z.object({
  id: z.string().optional(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
}).passthrough();
const definitionSchema = z.object({
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
  viewport: z.any().optional(),
});

const SCHEMA_VERSION = 1;

// Flatten the visual graph into a linear steps[] the runner understands.
// Triggers populate trigger_type / trigger_config. Conditions become
// { type: 'condition', config, then_steps, else_steps }.
function flattenDefinition(def: z.infer<typeof definitionSchema>) {
  const triggerNode = def.nodes.find(n => n.type === "trigger");
  if (!triggerNode) throw new Error("Workflow needs a trigger");

  const triggerType = (triggerNode.data.blockId as string).replace(/^trigger\./, "");
  const triggerConfig = triggerNode.data.config ?? {};

  const byId = new Map(def.nodes.map(n => [n.id, n]));
  const nextOf = (nodeId: string, handle?: string) => {
    const edge = def.edges.find(e =>
      e.source === nodeId && (handle ? e.sourceHandle === handle : !e.sourceHandle || e.sourceHandle === "true" || e.sourceHandle == null),
    );
    return edge ? byId.get(edge.target) : undefined;
  };

  function walk(start: any, seen = new Set<string>()): any[] {
    const out: any[] = [];
    let cur = start;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.type === "condition") {
        const yesEdge = def.edges.find(e => e.source === cur.id && e.sourceHandle === "true");
        const noEdge = def.edges.find(e => e.source === cur.id && e.sourceHandle === "false");
        out.push({
          type: "condition",
          config: { blockId: cur.data.blockId, ...cur.data.config },
          then_steps: yesEdge ? walk(byId.get(yesEdge.target), new Set(seen)) : [],
          else_steps: noEdge ? walk(byId.get(noEdge.target), new Set(seen)) : [],
        });
        return out;
      }
      const blockId: string = cur.data.blockId;
      out.push({
        type: blockId.replace(/^(action|delay)\./, ""),
        config: cur.data.config ?? {},
      });
      cur = nextOf(cur.id);
    }
    return out;
  }

  const firstAfterTrigger = nextOf(triggerNode.id);
  const steps = firstAfterTrigger ? walk(firstAfterTrigger) : [];
  return { triggerType, triggerConfig, steps };
}

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: workflows, error } = await supabase.from("workflows").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (workflows ?? []).map((w: any) => w.id);
    let counts: Record<string, { running: number; completed: number }> = {};
    if (ids.length) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data: instances } = await supabase
        .from("workflow_instances")
        .select("workflow_id,status,completed_at")
        .in("workflow_id", ids);
      for (const wf of workflows ?? []) counts[wf.id] = { running: 0, completed: 0 };
      for (const i of instances ?? []) {
        const c = counts[i.workflow_id]; if (!c) continue;
        if (i.status === "running") c.running++;
        if (i.status === "completed" && i.completed_at && new Date(i.completed_at) >= monthStart) c.completed++;
      }
    }
    return (workflows ?? []).map((w: any) => ({ ...w, _counts: counts[w.id] ?? { running: 0, completed: 0 } }));
  });

export const getWorkflow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("workflows").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    if (data.id) {
      const { data: row, error } = await supabase.from("workflows").update({
        name: data.name, status: data.status, trigger_type: data.trigger_type,
        trigger_config: data.trigger_config as any, steps: data.steps as any, stop_conditions: data.stop_conditions as any,
      }).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase.from("workflows").insert({
      team_id: profile.team_id, name: data.name, status: data.status,
      trigger_type: data.trigger_type, trigger_config: data.trigger_config as any,
      steps: data.steps as any, stop_conditions: data.stop_conditions as any, template_id: data.template_id ?? null,
      created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ templateId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tpl = WORKFLOW_TEMPLATES[data.templateId as WorkflowTemplateId];
    if (!tpl) throw new Error("Unknown template");
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const { data: row, error } = await supabase.from("workflows").insert({
      team_id: profile.team_id,
      name: tpl.name,
      status: "draft",
      trigger_type: tpl.trigger_type,
      trigger_config: tpl.trigger_config as any,
      steps: tpl.steps as any,
      stop_conditions: tpl.stop_conditions as any,
      template_id: data.templateId,
      created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workflows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- New visual-builder server functions ----------

export const createBlankWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().min(1).max(120).default("Untitled workflow") }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const { data: row, error } = await supabase.from("workflows").insert({
      team_id: profile.team_id, name: data.name, status: "draft",
      trigger_type: "manual", trigger_config: {}, steps: [],
      definition: { nodes: [], edges: [] }, enabled: false, created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveWorkflowDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120),
      enabled: z.boolean(),
      definition: definitionSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { triggerType, triggerConfig, steps } = flattenDefinition(data.definition);
    const { data: row, error } = await context.supabase.from("workflows").update({
      name: data.name,
      enabled: data.enabled,
      status: data.enabled ? "active" : "draft",
      definition: data.definition as any,
      trigger_type: triggerType,
      trigger_config: triggerConfig as any,
      steps: steps as any,
    }).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const runWorkflowNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: wf, error } = await supabase.from("workflows").select("*").eq("id", data.id).single();
    if (error || !wf) throw new Error(error?.message || "Workflow not found");

    // Naive matching: pull up to 500 contacts, filter by trigger if configured.
    const { data: contacts } = await supabase.from("contacts").select("id,lead_score").eq("team_id", wf.team_id).limit(500);
    let matched = (contacts ?? []);
    if (wf.trigger_type === "score_above") {
      const thr = Number((wf.trigger_config as any)?.threshold ?? 0);
      matched = matched.filter((c: any) => (c.lead_score ?? 0) >= thr);
    }

    const { data: run } = await supabase.from("workflow_runs").insert({
      workflow_id: wf.id, team_id: wf.team_id, triggered_by: userId,
      trigger_source: "manual", contacts_matched: matched.length, status: "running",
    }).select("*").single();

    // Enqueue workflow_instances + first job per contact (cap to 100 for safety).
    const cap = matched.slice(0, 100);
    if (cap.length) {
      const { data: insts } = await supabase.from("workflow_instances").insert(
        cap.map((c: any) => ({ workflow_id: wf.id, team_id: wf.team_id, contact_id: c.id, status: "running", current_step: 0 })),
      ).select("id");
      if (insts?.length) {
        await supabase.from("job_queue").insert(
          insts.map((i: any) => ({
            team_id: wf.team_id, job_type: "workflow_step", scheduled_for: new Date().toISOString(),
            payload: { instance_id: i.id, step_index: 0, run_id: run?.id },
          })),
        );
      }
    }
    await supabase.from("workflows").update({ last_run_at: new Date().toISOString(), last_run_stats: { matched: matched.length } as any }).eq("id", wf.id);
    return { ok: true, matched: matched.length, runId: run?.id };
  });

export const listWorkflowRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workflowId: z.string().uuid(), limit: z.number().min(1).max(200).default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("workflow_runs").select("*")
      .eq("workflow_id", data.workflowId)
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const exportWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: wf, error } = await context.supabase.from("workflows").select("name,trigger_type,trigger_config,definition,steps,stop_conditions").eq("id", data.id).single();
    if (error || !wf) throw new Error(error?.message || "Not found");
    return JSON.stringify({ schema_version: SCHEMA_VERSION, ...wf }, null, 2);
  });

export const importWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ json: z.string().min(2).max(500_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let parsed: any;
    try { parsed = JSON.parse(data.json); } catch { throw new Error("Invalid JSON"); }
    if (parsed.schema_version !== SCHEMA_VERSION) throw new Error("Unsupported schema version");
    const def = definitionSchema.parse(parsed.definition ?? { nodes: [], edges: [] });
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const { data: row, error } = await supabase.from("workflows").insert({
      team_id: profile.team_id,
      name: (parsed.name as string) || "Imported workflow",
      status: "draft", enabled: false,
      trigger_type: parsed.trigger_type || "manual",
      trigger_config: parsed.trigger_config ?? {},
      definition: def as any,
      steps: parsed.steps ?? [],
      stop_conditions: parsed.stop_conditions ?? [],
      created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });
