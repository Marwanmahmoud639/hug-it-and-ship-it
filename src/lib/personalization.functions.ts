import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findBlockedMatches, DEFAULT_BLOCKED_KEYWORDS } from "@/lib/blocked-keywords";

type Provider = "lovable" | "anthropic";

async function callProvider(provider: Provider, system: string, user: string): Promise<string> {
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 600,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const j = await res.json();
    return j.content?.[0]?.text ?? "";
  }
  // Lovable AI Gateway
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (res.status === 429) throw new Error("Rate limited");
  if (res.status === 402) throw new Error("AI credits exhausted");
  if (!res.ok) throw new Error(`AI gateway ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function buildPrompt(campaign: any, contact: any, variant: string) {
  const channel = (campaign.type || "email").toUpperCase();
  const tone =
    variant === "warm_followup"
      ? "They opened the previous email. Acknowledge the interest subtly and move toward a call."
      : variant === "cold_followup"
      ? "They did NOT open the previous email. Try a fresh angle, different hook."
      : "First-touch cold outreach.";
  const system = `You write high-converting B2B ${channel} outreach. Punchy, personal, direct. ${tone} ${
    campaign.type === "sms" ? "Strict 160-char limit." : "Under 120 words."
  } Output ONLY the message body — no preamble, no quotes, no subject line.`;
  const user = `Campaign goal: ${campaign.body || campaign.subject || campaign.name}

Contact:
- Name: ${contact.name ?? ""}
- Title: ${contact.title ?? ""}
- Company: ${contact.company ?? ""}
- Industry: ${contact.industry ?? ""}
- City: ${contact.city ?? ""}

Write the message now.`;
  return { system, user };
}

export const generatePersonalizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      campaignId: z.string().uuid(),
      contactIds: z.array(z.string().uuid()).min(1).max(500),
      variant: z.enum(["initial", "warm_followup", "cold_followup"]).default("initial"),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");

    const { data: settings } = await supabase
      .from("team_settings").select("ai_provider, blocked_keywords").eq("team_id", profile.team_id).single();
    const provider: Provider = (settings?.ai_provider === "anthropic" && process.env.ANTHROPIC_API_KEY)
      ? "anthropic" : "lovable";
    const blockedKws: string[] = (settings?.blocked_keywords as string[] | null) ?? DEFAULT_BLOCKED_KEYWORDS;

    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", data.campaignId).single();
    if (!campaign) throw new Error("Campaign not found");

    const { data: contacts } = await supabase.from("contacts").select("*").in("id", data.contactIds);
    if (!contacts?.length) throw new Error("No contacts");

    // Seed pending rows
    await supabase.from("ai_personalization_jobs").upsert(
      contacts.map((c: any) => ({
        team_id: profile.team_id!,
        campaign_id: data.campaignId,
        contact_id: c.id,
        variant: data.variant,
        status: "pending" as const,
        ai_provider: provider,
      })),
      { onConflict: "campaign_id,contact_id,variant" }
    );

    // Process in batches of 10
    let succeeded = 0, failed = 0;
    for (let i = 0; i < contacts.length; i += 10) {
      const batch = contacts.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (c: any) => {
          const { system, user } = buildPrompt(campaign, c, data.variant);
          const text = await callProvider(provider, system, user);
          return { contact_id: c.id, text };
        })
      );
      let blocked = 0;
      for (const r of results) {
        if (r.status === "fulfilled") {
          const matches = findBlockedMatches(r.value.text, blockedKws);
          if (matches.length > 0) {
            blocked++;
            await supabase.from("ai_personalization_jobs").update({
              generated_message: r.value.text,
              status: "failed",
              error: `Blocked keywords: ${matches.join(", ")}`,
            }).eq("campaign_id", data.campaignId).eq("contact_id", r.value.contact_id).eq("variant", data.variant);
          } else {
            succeeded++;
            await supabase.from("ai_personalization_jobs").update({
              generated_message: r.value.text, status: "generated", error: null,
            }).eq("campaign_id", data.campaignId).eq("contact_id", r.value.contact_id).eq("variant", data.variant);
          }
        } else {
          failed++;
        }
      }
      (results as any)._blocked = blocked;
    }
    return { succeeded, failed, provider };
  });

export const approvePersonalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      jobId: z.string().uuid(),
      editedMessage: z.string().max(8000).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: any = { status: "approved", approved_by: userId, approved_at: new Date().toISOString() };
    if (data.editedMessage !== undefined) patch.edited_message = data.editedMessage;
    const { error } = await supabase.from("ai_personalization_jobs").update(patch).eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regeneratePersonalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job } = await supabase.from("ai_personalization_jobs").select("*").eq("id", data.jobId).single();
    if (!job) throw new Error("Job not found");
    const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", job.campaign_id).single();
    const { data: contact } = await supabase.from("contacts").select("*").eq("id", job.contact_id).single();
    const provider = (job.ai_provider as Provider) || "lovable";
    const { system, user } = buildPrompt(campaign, contact, job.variant);
    const text = await callProvider(provider, system, user);
    await supabase.from("ai_personalization_jobs").update({
      generated_message: text, status: "generated", approved_by: null, approved_at: null,
    }).eq("id", data.jobId);
    return { text };
  });

export const bulkApprove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      campaignId: z.string().uuid(),
      minScore: z.number().min(0).max(100).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("ai_personalization_jobs").select("id, contact:contacts(lead_score)")
      .eq("campaign_id", data.campaignId).eq("status", "generated");
    const { data: rows } = await q;
    const ids = (rows || []).filter((r: any) => {
      if (data.minScore == null) return true;
      return (r.contact?.lead_score ?? 0) >= data.minScore;
    }).map((r: any) => r.id);
    if (!ids.length) return { approved: 0 };
    await supabase.from("ai_personalization_jobs").update({
      status: "approved", approved_by: userId, approved_at: new Date().toISOString(),
    }).in("id", ids);
    return { approved: ids.length };
  });
