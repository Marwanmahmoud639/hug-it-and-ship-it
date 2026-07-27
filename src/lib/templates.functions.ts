import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KINDS = ["email", "sms", "call_script", "dm"] as const;
const PLATFORMS = ["facebook", "instagram", "linkedin"] as const;

/** Merge fields look like {first_name}. Kept in sync on write so the UI can
 *  show what a template expects without re-parsing bodies on every render. */
function extractVariables(...bodies: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const body of bodies) {
    if (!body) continue;
    for (const m of body.matchAll(/\{\{?\s*([a-z0-9_]+)\s*\}?\}/gi)) {
      found.add(m[1].toLowerCase());
    }
  }
  return Array.from(found);
}

async function teamIdFor(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
  if (!data?.team_id) throw new Error("No team");
  return data.team_id as string;
}

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: z.enum(KINDS).optional(),
      platform: z.enum(PLATFORMS).optional(),
      industry: z.string().max(100).optional(),
      includeInactive: z.boolean().default(false),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const teamId = await teamIdFor(supabase, userId);
    let q = (supabase as any)
      .from("content_templates")
      .select("*")
      .eq("team_id", teamId)
      .order("times_used", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.platform) q = q.eq("platform", data.platform);
    if (data.industry) q = q.eq("industry", data.industry);
    if (!data.includeInactive) q = q.eq("is_active", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { templates: rows ?? [] };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(KINDS),
  platform: z.enum(PLATFORMS).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  subject: z.string().max(300).nullable().optional(),
  body_text: z.string().max(20000).default(""),
  body_html: z.string().max(100000).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  is_active: z.boolean().default(true),
}).superRefine((v, ctx) => {
  // Mirrors the DB check constraints so users get a readable error instead of
  // a raw Postgres violation.
  if (v.kind === "dm" && !v.platform) {
    ctx.addIssue({ code: "custom", path: ["platform"], message: "Pick a platform for a DM template" });
  }
  if (v.kind !== "dm" && v.platform) {
    ctx.addIssue({ code: "custom", path: ["platform"], message: "Only DM templates have a platform" });
  }
  if (v.kind !== "email" && v.subject) {
    ctx.addIssue({ code: "custom", path: ["subject"], message: "Only email templates have a subject" });
  }
  if (v.kind !== "email" && v.body_html) {
    ctx.addIssue({ code: "custom", path: ["body_html"], message: "Only email templates have an HTML body" });
  }
});

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const teamId = await teamIdFor(supabase, userId);

    const row = {
      team_id: teamId,
      kind: data.kind,
      platform: data.kind === "dm" ? data.platform ?? null : null,
      name: data.name,
      description: data.description ?? null,
      industry: data.industry || null,
      subject: data.kind === "email" ? data.subject ?? null : null,
      body_text: data.body_text,
      body_html: data.kind === "email" ? data.body_html ?? null : null,
      variables: extractVariables(data.body_text, data.body_html, data.subject),
      tags: data.tags,
      is_active: data.is_active,
    };

    if (data.id) {
      const { data: updated, error } = await (supabase as any)
        .from("content_templates")
        .update(row)
        .eq("id", data.id)
        .eq("team_id", teamId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("Template not found");
      return { id: updated.id as string };
    }

    const { data: inserted, error } = await (supabase as any)
      .from("content_templates")
      .insert({ ...row, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const teamId = await teamIdFor(supabase, userId);
    const { error } = await (supabase as any)
      .from("content_templates")
      .delete()
      .eq("id", data.id)
      .eq("team_id", teamId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Duplicate an existing template as a starting point, counters reset to zero. */
export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const teamId = await teamIdFor(supabase, userId);
    const { data: src, error: readErr } = await (supabase as any)
      .from("content_templates")
      .select("*")
      .eq("id", data.id)
      .eq("team_id", teamId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!src) throw new Error("Template not found");

    const { data: inserted, error } = await (supabase as any)
      .from("content_templates")
      .insert({
        team_id: teamId,
        created_by: userId,
        kind: src.kind,
        platform: src.platform,
        name: `${src.name} (copy)`,
        description: src.description,
        industry: src.industry,
        subject: src.subject,
        body_text: src.body_text,
        body_html: src.body_html,
        variables: src.variables,
        tags: src.tags,
        is_active: false, // copies start inactive so they can't be sent by accident
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });
