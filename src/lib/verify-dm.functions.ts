import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_RX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type AIResult = { json: any; raw: string };

async function callClaude(args: {
  apiKey: string;
  system: string;
  user: string;
}): Promise<AIResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 600,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data?.content?.[0]?.text || "";
  return { json: tryParseJson(text), raw: text };
}

async function callLovableAI(args: { system: string; user: string }): Promise<AIResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limits exceeded, please try again later.");
    if (res.status === 402) throw new Error("Payment required — add Lovable AI credits.");
    throw new Error(`Lovable AI ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || "";
  return { json: tryParseJson(text), raw: text };
}

function tryParseJson(s: string): any {
  if (!s) return null;
  // Strip code fences if present
  const cleaned = s.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Look for first {...} block
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { return null; }
    }
    return null;
  }
}

async function aiJson(args: { settings: any; system: string; user: string }): Promise<any> {
  const claudeKey = args.settings?.claude_api_key as string | null;
  if (claudeKey) {
    try {
      const r = await callClaude({ apiKey: claudeKey, system: args.system, user: args.user });
      if (r.json) return r.json;
    } catch (e) {
      console.error("Claude call failed, falling back to Lovable AI:", e);
    }
  }
  const r = await callLovableAI({ system: args.system, user: args.user });
  return r.json || {};
}

export const verifyDecisionMaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      contactId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");

    const { data: contact, error: cErr } = await supabase
      .from("contacts").select("*").eq("id", data.contactId).eq("team_id", profile.team_id).single();
    if (cErr || !contact) throw new Error("Contact not found");

    const { data: settings } = await supabase
      .from("team_settings").select("claude_api_key, icp_definition")
      .eq("team_id", profile.team_id).maybeSingle();

    // STEP 1 — email verification
    const emailSystem =
      "You are an email verification expert. Given a prospect's name, title, company, and email, assess whether the email is valid, the domain looks real, and the person is plausibly a decision maker. Respond ONLY with strict JSON.";
    const emailUser = `Prospect:
- Name: ${contact.name || "(unknown)"}
- Title: ${contact.title || "(unknown)"}
- Company: ${contact.company || "(unknown)"}
- Email: ${contact.email || "(none)"}
- Industry: ${contact.industry || "(unknown)"}

Format check: ${contact.email && EMAIL_RX.test(contact.email) ? "syntactically valid" : "syntactically invalid or missing"}

Respond as JSON: {"email_valid": boolean, "confidence_score": 0-100, "reason": "short explanation"}`;

    const emailResult = await aiJson({ settings, system: emailSystem, user: emailUser });
    const email_valid = !!emailResult.email_valid;
    const email_confidence = clamp(Number(emailResult.confidence_score) || 0, 0, 100);
    const email_reason = String(emailResult.reason || "").slice(0, 500);

    // STEP 2 — ICP fit
    const icpDefinition = (settings?.icp_definition || "").trim();
    let icp_matches: boolean | null = null;
    let icp_score: number | null = null;
    let icp_reason: string | null = null;

    if (icpDefinition) {
      const icpSystem =
        "You are an ICP (Ideal Customer Profile) evaluation expert. Determine if the prospect matches the user's ICP. Respond ONLY with strict JSON.";
      const icpUser = `ICP Definition: ${icpDefinition}

Prospect Data:
- Name: ${contact.name || "(unknown)"}
- Title: ${contact.title || "(unknown)"}
- Company: ${contact.company || "(unknown)"}
- Industry: ${contact.industry || "(unknown)"}
- Location: ${[contact.city, contact.state, contact.country].filter(Boolean).join(", ") || "(unknown)"}

Question: Does this prospect match the ICP?

Respond as JSON: {"matches": boolean, "score": 0-100, "reasoning": "short explanation"}`;

      const icpResult = await aiJson({ settings, system: icpSystem, user: icpUser });
      icp_matches = !!icpResult.matches;
      icp_score = clamp(Number(icpResult.score) || 0, 0, 100);
      icp_reason = String(icpResult.reasoning || "").slice(0, 500);
    }

    const { error: updErr } = await supabase
      .from("contacts")
      .update({
        email_verified_by_ai: email_valid,
        email_ai_confidence: email_confidence,
        email_ai_reason: email_reason,
        icp_matches,
        icp_fit_score: icp_score,
        icp_fit_reason: icp_reason,
        ai_verified_at: new Date().toISOString(),
      })
      .eq("id", contact.id)
      .eq("team_id", profile.team_id);
    if (updErr) throw new Error(updErr.message);

    return {
      email: { valid: email_valid, confidence: email_confidence, reason: email_reason },
      icp: icpDefinition
        ? { matches: icp_matches, score: icp_score, reason: icp_reason }
        : { matches: null, score: null, reason: "ICP not configured in Settings → AI" },
    };
  });

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
