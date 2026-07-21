import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTeamId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
  if (!profile?.team_id) throw new Error("No team");
  return profile.team_id as string;
}

export const listAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("voice_agents")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(1000).optional().default(""),
      voice_id: z.string().max(80).default("alloy"),
      voice_provider: z.enum(["web_speech", "elevenlabs", "openai"]).default("web_speech"),
      language: z.string().max(20).default("en-US"),
      script: z.string().default(""),
      system_prompt: z.string().default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("voice_agents").insert({
      team_id: teamId,
      created_by: context.userId,
      name: data.name,
      description: data.description,
      voice_id: data.voice_id,
      voice_provider: data.voice_provider,
      language: data.language,
      script: data.script,
      system_prompt: data.system_prompt || "You are a friendly, professional AI cold caller. Introduce yourself, listen carefully, and handle objections gracefully.",
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(1000).optional(),
        voice_id: z.string().max(80).optional(),
        voice_provider: z.enum(["web_speech", "elevenlabs", "openai"]).optional(),
        language: z.string().max(20).optional(),
        script: z.string().optional(),
        system_prompt: z.string().optional(),
        status: z.enum(["active", "paused", "archived"]).optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("voice_agents")
      .update(data.patch)
      .eq("id", data.id)
      .eq("team_id", teamId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { error } = await context.supabase.from("voice_agents").delete().eq("id", data.id).eq("team_id", teamId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Knowledge
export const listKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ agent_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("agent_knowledge")
      .select("id, title, kind, storage_path, tokens, created_at")
      .eq("agent_id", data.agent_id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addKnowledgeText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      agent_id: z.string().uuid(),
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(200_000),
      kind: z.enum(["text", "pdf", "doc", "url"]).default("text"),
      storage_path: z.string().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("agent_knowledge").insert({
      agent_id: data.agent_id,
      team_id: teamId,
      title: data.title,
      kind: data.kind,
      storage_path: data.storage_path ?? null,
      content: data.content,
      tokens: Math.ceil(data.content.length / 4),
      uploaded_by: context.userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { error } = await context.supabase.from("agent_knowledge").delete().eq("id", data.id).eq("team_id", teamId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Objections
export const listObjections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ agent_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("agent_objections")
      .select("*")
      .eq("agent_id", data.agent_id)
      .eq("team_id", teamId)
      .order("times_encountered", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertObjection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      agent_id: z.string().uuid(),
      objection: z.string().min(1).max(500),
      rebuttal: z.string().max(2000).default(""),
      approved: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("agent_objections")
        .update({ objection: data.objection, rebuttal: data.rebuttal, approved: data.approved })
        .eq("id", data.id)
        .eq("team_id", teamId)
        .select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("agent_objections").insert({
      agent_id: data.agent_id,
      team_id: teamId,
      objection: data.objection,
      rebuttal: data.rebuttal,
      auto_learned: false,
      approved: data.approved,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

// Training sessions
export const saveTrainingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      agent_id: z.string().uuid(),
      title: z.string().max(200).optional().nullable(),
      transcript: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string(),
        at: z.number().optional(),
      })),
      duration_seconds: z.number().int().min(0).default(0),
      notes: z.string().max(4000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("training_sessions").insert({
      agent_id: data.agent_id,
      team_id: teamId,
      user_id: context.userId,
      title: data.title ?? null,
      transcript: data.transcript,
      duration_seconds: data.duration_seconds,
      notes: data.notes ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listTrainingSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ agent_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("training_sessions")
      .select("id, title, duration_seconds, notes, created_at")
      .eq("agent_id", data.agent_id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Chat with agent (used by training studio). Uses Lovable AI Gateway.
export const chatWithAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      agent_id: z.string().uuid(),
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      })).min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: agent, error: agentErr } = await context.supabase
      .from("voice_agents").select("*").eq("id", data.agent_id).eq("team_id", teamId).single();
    if (agentErr || !agent) throw new Error("Agent not found");

    const { data: knowledge } = await context.supabase
      .from("agent_knowledge").select("title, content").eq("agent_id", agent.id).eq("team_id", teamId).limit(20);
    const { data: objections } = await context.supabase
      .from("agent_objections").select("objection, rebuttal").eq("agent_id", agent.id).eq("team_id", teamId).eq("approved", true).limit(50);

    const knowledgeText = (knowledge ?? []).map((k: any) => `## ${k.title}\n${(k.content || "").slice(0, 4000)}`).join("\n\n");
    const objectionText = (objections ?? []).map((o: any) => `- Objection: "${o.objection}" → Rebuttal: "${o.rebuttal}"`).join("\n");

    const systemPrompt = [
      agent.system_prompt || "You are a friendly, professional AI cold caller.",
      agent.script ? `\n\n### Your call script:\n${agent.script}` : "",
      knowledgeText ? `\n\n### Knowledge base (reference only, do not read verbatim):\n${knowledgeText}` : "",
      objectionText ? `\n\n### Objection handling (use these rebuttals when the prospect raises them):\n${objectionText}` : "",
      "\n\nKeep replies conversational, warm, and short — one or two sentences unless asked. If the caller asks something outside your knowledge, be honest.",
    ].join("");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway ${res.status}: ${text.slice(0, 400)}`);
    }
    const json = await res.json();
    const reply: string = json?.choices?.[0]?.message?.content ?? "";
    return { reply };
  });

// Calls
export const startCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      agent_id: z.string().uuid(),
      contact_id: z.string().uuid().optional().nullable(),
      phone_number: z.string().max(30).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("call_runs").insert({
      agent_id: data.agent_id,
      team_id: teamId,
      contact_id: data.contact_id ?? null,
      initiated_by: context.userId,
      phone_number: data.phone_number ?? null,
      status: "queued",
      started_at: new Date().toISOString(),
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      patch: z.object({
        status: z.enum(["queued", "dialing", "connected", "completed", "failed", "paused", "no_answer"]).optional(),
        outcome: z.enum(["interested", "not_interested", "callback", "voicemail", "wrong_number", "no_answer", "converted"]).optional().nullable(),
        duration_seconds: z.number().int().min(0).optional(),
        transcript: z.string().optional(),
        summary: z.string().optional().nullable(),
        objections_encountered: z.array(z.string()).optional(),
        ended_at: z.string().optional().nullable(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.from("call_runs")
      .update(data.patch).eq("id", data.id).eq("team_id", teamId).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listCallRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    agent_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    let q = context.supabase.from("call_runs")
      .select("id, agent_id, contact_id, phone_number, status, outcome, duration_seconds, summary, created_at, started_at, ended_at")
      .eq("team_id", teamId).order("created_at", { ascending: false }).limit(data.limit);
    if (data.agent_id) q = q.eq("agent_id", data.agent_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCallStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ agent_id: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    let q = context.supabase.from("call_runs")
      .select("status, outcome, duration_seconds")
      .eq("team_id", teamId);
    if (data.agent_id) q = q.eq("agent_id", data.agent_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const total = list.length;
    const completed = list.filter((r: any) => r.status === "completed").length;
    const connected = list.filter((r: any) => ["connected", "completed"].includes(r.status)).length;
    const converted = list.filter((r: any) => r.outcome === "converted" || r.outcome === "interested").length;
    const totalDuration = list.reduce((s: number, r: any) => s + (r.duration_seconds || 0), 0);
    return {
      total_calls: total,
      completed,
      connected,
      converted,
      connect_rate: total ? Math.round((connected / total) * 100) : 0,
      conversion_rate: total ? Math.round((converted / total) * 100) : 0,
      avg_duration: completed ? Math.round(totalDuration / completed) : 0,
    };
  });

// After a call: learn objections
export const learnFromCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    call_run_id: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const teamId = await getTeamId(context.supabase, context.userId);
    const { data: run } = await context.supabase.from("call_runs")
      .select("*").eq("id", data.call_run_id).eq("team_id", teamId).single();
    if (!run) throw new Error("Call not found");
    if (!run.transcript || run.transcript.length < 30) return { learned: 0 };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const prompt = `You are analyzing a sales call transcript. Extract every objection the prospect raised, and suggest a short one-sentence rebuttal for each. Reply with JSON only, shaped as {"objections":[{"objection":"...","rebuttal":"..."}]}. Transcript:\n\n${run.transcript.slice(0, 8000)}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return { learned: 0 };
    const json = await res.json();
    let parsed: any = {};
    try { parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }
    const items: Array<{ objection: string; rebuttal: string }> = Array.isArray(parsed?.objections) ? parsed.objections : [];
    let learned = 0;
    for (const it of items.slice(0, 10)) {
      if (!it?.objection) continue;
      const { data: existing } = await context.supabase.from("agent_objections")
        .select("id, times_encountered")
        .eq("agent_id", run.agent_id).eq("team_id", teamId)
        .ilike("objection", it.objection.slice(0, 80)).limit(1).maybeSingle();
      if (existing) {
        await context.supabase.from("agent_objections")
          .update({ times_encountered: (existing.times_encountered || 0) + 1 })
          .eq("id", existing.id);
      } else {
        await context.supabase.from("agent_objections").insert({
          agent_id: run.agent_id,
          team_id: teamId,
          objection: it.objection.slice(0, 500),
          rebuttal: (it.rebuttal || "").slice(0, 2000),
          auto_learned: true,
          approved: false,
        });
        learned++;
      }
    }
    return { learned };
  });
