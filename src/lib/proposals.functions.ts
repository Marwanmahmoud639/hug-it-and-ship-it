import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  prospect_name: z.string().min(1).max(120),
  business_name: z.string().min(1).max(200),
  industry: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  current_lead_method: z.string().max(100).optional().nullable(),
  monthly_lead_goal: z.number().int().nullable().optional(),
  notes: z.string().max(2000).optional().nullable(),
  package_selected: z.enum(["starter", "growth", "scale", "enterprise"]),
  package_price: z.number().int().nullable().optional(),
  guarantee_text: z.string().max(500).optional().nullable(),
  testimonial: z.string().max(2000).optional().nullable(),
  cta_url: z.string().url().optional().nullable().or(z.literal("")),
  expires_in_days: z.number().int().min(1).max(90).default(14),
  sample_leads: z.array(z.record(z.string(), z.any())).max(10).default([]),
});

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("proposals").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const expires_at = new Date(Date.now() + data.expires_in_days * 86400_000).toISOString();
    const { data: row, error } = await supabase.from("proposals").insert({
      team_id: profile.team_id,
      prospect_name: data.prospect_name,
      business_name: data.business_name,
      industry: data.industry ?? null,
      location: data.location ?? null,
      current_lead_method: data.current_lead_method ?? null,
      monthly_lead_goal: data.monthly_lead_goal ?? null,
      notes: data.notes ?? null,
      package_selected: data.package_selected,
      package_price: data.package_price ?? null,
      guarantee_text: data.guarantee_text ?? null,
      testimonial: data.testimonial ?? null,
      cta_url: data.cta_url || null,
      expires_at,
      status: "sent",
      sample_leads: data.sample_leads as any,
      created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateProposalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["draft", "sent", "viewed", "won", "lost"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("proposals").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("proposals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Live preview: runs a quick contacts query as sample leads (uses existing data
// to avoid spending Discovery API credits on a preview). Falls back to empty.
export const proposalLivePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    industry: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("contacts").select("name,title,company,email,phone,linkedin_url,lead_score").order("lead_score", { ascending: false }).limit(10);
    if (data.industry) q = q.ilike("industry", `%${data.industry}%`);
    if (data.location) q = q.or(`city.ilike.%${data.location}%,state.ilike.%${data.location}%`);
    const { data: rows } = await q;
    return { leads: rows ?? [] };
  });
