import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- helpers ----------
async function getTeamId(supabase: any, userId: string) {
  const { data } = await supabase.rpc("get_user_team", { _user_id: userId });
  if (!data) throw new Error("No team");
  return data as string;
}

async function callLovableAI(system: string, prompt: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("AI rate limited — try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted");
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const j = await res.json();
  const content = j.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

// ---------- get progress ----------
export const getOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);
    const { data: team } = await supabase
      .from("teams")
      .select("id, name, plan_status, onboarding_completed_at, trial_ends_at, ideal_customer, sending_email_provider, sending_email_address")
      .eq("id", teamId)
      .maybeSingle();
    let { data: op } = await supabase
      .from("onboarding_progress")
      .select("*")
      .eq("team_id", teamId)
      .maybeSingle();
    if (!op) {
      const ins = await supabase.from("onboarding_progress").insert({ team_id: teamId, current_step: 1 }).select("*").single();
      op = ins.data;
    }
    return { team, progress: op };
  });

// ---------- save step ----------
const saveSchema = z.object({
  step: z.number().int().min(1).max(9),
  patch: z.record(z.any()).default({}),
});
export const saveOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);
    const patch: any = { current_step: data.step, updated_at: new Date().toISOString(), ...data.patch };
    const { error } = await supabase.from("onboarding_progress").upsert({ team_id: teamId, ...patch }, { onConflict: "team_id" });
    if (error) throw new Error(error.message);
    // If patch includes business_name, propagate to teams.name
    if (typeof data.patch?.business_name === "string" && data.patch.business_name.trim()) {
      await supabase.from("teams").update({ name: data.patch.business_name.trim() }).eq("id", teamId);
    }
    return { ok: true };
  });

// ---------- scan domain (Lovable AI, fetch+parse) ----------
const scanSchema = z.object({ domain: z.string().min(3).max(200) });
export const scanDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scanSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);

    // Normalize URL
    let url = data.domain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
    const host = url.split("/")[0];
    const full = `https://${host}`;

    // Fetch homepage + best-effort about/pricing pages
    async function grab(path: string) {
      try {
        const r = await fetch(`${full}${path}`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Reach4Dollars/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return "";
        const html = await r.text();
        return html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 8000);
      } catch { return ""; }
    }
    const [home, about, services] = await Promise.all([grab(""), grab("/about"), grab("/services")]);
    const text = [home, about, services].filter(Boolean).join("\n\n---\n\n").slice(0, 18000);

    if (!text) throw new Error("Couldn't reach that site. Double-check the domain.");

    const system = `You are a B2B sales intelligence analyst. From the website copy, produce a strict JSON object matching this shape:
{
  "summary": "3-4 sentence plain-English description of what this company does",
  "personas": {
    "job_titles": ["Founder", "VP Sales", ...],   // 5-8 titles most likely to be their buyers
    "locations": ["United States"],                // regions/countries; empty array if global
    "keywords": ["burned prospect lists", ...]     // 6-10 pain/topic keywords the buyer cares about
  },
  "firmographics": {
    "company_sizes": ["2-10 employees", "11-50 employees"], // 1-3 bands
    "industries": ["Marketing Services", ...],              // 2-5 target industries
    "revenue_bands": ["<$1M", "$1-5M"],                     // 1-3 bands
    "funding_stages": ["Bootstrapped", "Seed"]              // optional
  },
  "signal_brief": {
    "competitors": [{"name":"Belkins","domain":"belkins.io"}],  // 4-6
    "relevant_topics": ["multichannel outbound", ...],           // 8-12
    "pain_points": ["Shared or purchased prospect lists are saturated..."], // 5-8 full sentences
    "buying_signals": ["A lead says their current outbound vendor is being replaced..."] // 5-8 full sentences
  }
}
Only return valid JSON. No markdown, no commentary.`;

    const result = await callLovableAI(system, `Website: ${host}\n\nCopy:\n${text}`);

    await supabase.from("onboarding_progress").upsert({
      team_id: teamId,
      domain: host,
      scan_result: result,
      personas: result.personas ?? null,
      firmographics: result.firmographics ?? null,
      signal_brief: result.signal_brief ?? null,
      current_step: 4,
      updated_at: new Date().toISOString(),
    }, { onConflict: "team_id" });

    return result;
  });

// ---------- generate first 5 sample leads via existing discovery ----------
export const generateSampleLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);
    const { data: op } = await supabase.from("onboarding_progress").select("*").eq("team_id", teamId).maybeSingle();
    const industries: string[] = op?.firmographics?.industries ?? [];
    const locations: string[] = op?.personas?.locations ?? ["United States"];
    const primaryIndustry = industries[0] ?? "Business Services";
    const primaryLocation = locations[0] ?? "United States";
    const titles: string[] = op?.personas?.job_titles ?? ["Owner"];

    // Call Lovable AI to synthesize 5 realistic ICP lead profiles derived from personas/firmographics.
    // These are preview cards - real discovery pulls happen when they hit /discovery post-trial.
    const system = `Generate 5 realistic B2B lead previews as strict JSON: {"leads":[{"name":"Jane Doe","title":"VP Sales","company":"Acme Roofing","industry":"Roofing","city":"Austin","state":"TX","reason":"Why this matches the ICP in one sentence"}]}. Companies must sound plausible (not famous brands). No commentary.`;
    const prompt = `Industry focus: ${primaryIndustry}. Target titles: ${titles.slice(0,4).join(", ")}. Location: ${primaryLocation}. Company sizes: ${(op?.firmographics?.company_sizes ?? []).join(", ") || "small businesses"}.`;
    const result = await callLovableAI(system, prompt);
    const leads = Array.isArray(result?.leads) ? result.leads.slice(0, 5) : [];

    await supabase.from("onboarding_progress").upsert({
      team_id: teamId,
      sample_leads: leads,
      updated_at: new Date().toISOString(),
    }, { onConflict: "team_id" });

    return { leads };
  });

// ---------- finalize onboarding ----------
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);
    const { data: op } = await supabase.from("onboarding_progress").select("*").eq("team_id", teamId).maybeSingle();
    if (!op) throw new Error("No onboarding row");

    const ideal_customer = {
      personas: op.personas ?? {},
      firmographics: op.firmographics ?? {},
      signal_brief: op.signal_brief ?? {},
      summary: op.scan_result?.summary ?? "",
      domain: op.domain ?? null,
      updated_at: new Date().toISOString(),
    };

    await supabase.from("teams").update({
      ideal_customer,
      onboarding_completed_at: new Date().toISOString(),
    }).eq("id", teamId);

    // If we've stored industries, seed team_settings.default_industry for discovery scoping.
    const industries: string[] = op.firmographics?.industries ?? [];
    if (industries.length) {
      await supabase.from("team_settings").update({ default_industry: industries.join(",") }).eq("team_id", teamId);
    }

    return { ok: true };
  });

// ---------- update ideal_customer subsections (edits from wizard) ----------
const patchPersonasSchema = z.object({ personas: z.any() });
export const savePersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patchPersonasSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);
    await supabase.from("onboarding_progress").upsert({ team_id: teamId, personas: data.personas, updated_at: new Date().toISOString() }, { onConflict: "team_id" });
    return { ok: true };
  });

const patchFirmoSchema = z.object({ firmographics: z.any() });
export const saveFirmographics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patchFirmoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);
    await supabase.from("onboarding_progress").upsert({ team_id: teamId, firmographics: data.firmographics, updated_at: new Date().toISOString() }, { onConflict: "team_id" });
    return { ok: true };
  });

const patchBriefSchema = z.object({ signal_brief: z.any() });
export const saveSignalBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patchBriefSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);
    await supabase.from("onboarding_progress").upsert({ team_id: teamId, signal_brief: data.signal_brief, updated_at: new Date().toISOString() }, { onConflict: "team_id" });
    return { ok: true };
  });

// Mark sending email as connected (Gmail via Google OAuth - user already signed in with Google)
const emailSchema = z.object({ provider: z.string().min(2).max(40), address: z.string().email() });
export const saveSendingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => emailSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const teamId = await getTeamId(supabase, userId);
    await supabase.from("teams").update({
      sending_email_provider: data.provider,
      sending_email_address: data.address,
    }).eq("id", teamId);
    return { ok: true };
  });
