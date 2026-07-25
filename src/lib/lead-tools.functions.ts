import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getTeamId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
  if (!data?.team_id) throw new Error("No team");
  return data.team_id as string;
}

/**
 * Draft a tailored outreach message via Lovable AI Gateway (Gemini).
 * Returns the message body only — no preamble, no quotes.
 */
export const generateLeadDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      contactId: z.string().uuid(),
      channel: z.enum(["email", "sms"]),
      instruction: z.string().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const team_id = await getTeamId(supabase, userId);
    const { data: contact } = await supabase
      .from("contacts")
      .select("name, title, company, industry, city, state, notes, tags")
      .eq("id", data.contactId).eq("team_id", team_id).maybeSingle();
    if (!contact) throw new Error("Contact not found");

    const { data: recentNotes } = await supabase
      .from("contact_notes").select("content")
      .eq("contact_id", data.contactId).eq("team_id", team_id)
      .order("created_at", { ascending: false }).limit(3);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway not configured");

    const channelRules = data.channel === "sms"
      ? "Strict 160-character limit. No subject. Conversational and direct. One clear ask."
      : "Under 110 words. Professional but warm. No corporate fluff. One clear ask. Output the email body only — no subject line, no greeting headers like 'Subject:'.";

    const system = `You write high-converting US real estate / business outreach. Always write in English. Natural, professional, ready-to-send. ${channelRules} Output ONLY the message body — no preamble, no quotes, no commentary.`;

    const notesBlock = (recentNotes ?? []).map((n: any) => `- ${n.content}`).join("\n");
    const user = `Lead:
- Name: ${contact.name ?? ""}
- Title: ${contact.title ?? ""}
- Company: ${contact.company ?? ""}
- Industry: ${contact.industry ?? ""}
- Location: ${[contact.city, contact.state].filter(Boolean).join(", ")}
${contact.tags?.length ? `- Tags: ${contact.tags.join(", ")}` : ""}
${notesBlock ? `\nRecent notes:\n${notesBlock}` : ""}
${data.instruction ? `\nExtra instruction from rep: ${data.instruction}` : ""}

Write the ${data.channel === "sms" ? "SMS" : "email"} now.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI is rate-limited, please retry shortly");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Workspace settings");
    if (!res.ok) throw new Error(`AI gateway error (${res.status})`);
    const j: any = await res.json();
    const draft = (j.choices?.[0]?.message?.content ?? "").trim();
    return { draft };
  });

/**
 * Validate a phone via Trestle Phone Intel.
 * Returns carrier, line type, country, valid/invalid. No owner name (free APIs do not reliably provide that).
 */
export const validatePhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      phone: z.string().min(7).max(32),
      contactId: z.string().uuid().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const team_id = await getTeamId(supabase, userId);

    const { data: settings } = await supabase
      .from("team_settings").select("trestle_api_key").eq("team_id", team_id).maybeSingle();
    const apiKey = settings?.trestle_api_key || process.env.TRESTLE_API_KEY;
    if (!apiKey) throw new Error("Trestle API key not configured in Settings");

    const cleaned = data.phone.replace(/[^\d+]/g, "");
    const url = new URL("https://api.trestleiq.com/3.1/phone_intel");
    url.searchParams.set("phone", cleaned);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Trestle ${res.status}${txt ? `: ${txt.slice(0, 120)}` : ""}`);
    }
    const j: any = await res.json();

    const result = {
      phone: cleaned,
      is_valid: Boolean(j.is_valid),
      line_type: j.line_type ?? null,
      carrier: j.carrier ?? null,
      country_code: j.country_code ?? null,
      country_name: j.country_name ?? null,
      country_calling_code: j.country_calling_code ?? null,
      is_prepaid: j.is_prepaid ?? null,
      is_commercial: j.is_commercial ?? null,
    };

    // Persist what we learned to contact_phones (best-effort, do not block)
    if (data.contactId) {
      try {
        const { data: existing } = await supabase
          .from("contact_phones").select("id")
          .eq("contact_id", data.contactId).eq("team_id", team_id)
          .eq("phone_number", cleaned).maybeSingle();
        const patch = {
          verified: true,
          line_type: result.line_type,
          carrier_name: result.carrier,
          carrier_lookup_date: new Date().toISOString(),
          is_sms_eligible: result.line_type === "Mobile",
        };
        if (existing?.id) {
          await supabase.from("contact_phones").update(patch).eq("id", existing.id);
        }
      } catch { /* ignore — display still works */ }
    }

    return { result };
  });

/**
 * Retry the decision-maker search for a business-only lead.
 * Re-invokes the discovery edge function's DM cascade for this single business,
 * updates the contact if a DM is found, moves it into the "New Lead" stage,
 * and charges the remaining 0.5 credit.
 */
export const retryDMSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const team_id = await getTeamId(supabase, userId);

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, name, company, city, state, business_only, dm_search_attempts")
      .eq("id", data.contactId).eq("team_id", team_id).maybeSingle();
    if (!contact) throw new Error("Contact not found");
    if (!contact.business_only) return { ok: true, message: "Already has decision maker.", found: false };

    // Free DM search: Google-style query via DuckDuckGo HTML endpoint
    let dmName: string | null = null;
    let dmSource: string | null = null;
    try {
      const q = encodeURIComponent(`"${contact.company}" ${contact.city || ""} ${contact.state || ""} (owner OR founder OR CEO OR president) site:linkedin.com/in`);
      const res = await fetch(`https://duckduckgo.com/html/?q=${q}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept-Language": "en-US,en",
        },
      });
      if (res.ok) {
        const html = await res.text();
        // pull first LinkedIn /in/ title, format "First Last - Title - Company | LinkedIn"
        const m = html.match(/linkedin\.com\/in\/[^"']+["'][^>]*>([^<]+)</i);
        if (m) {
          const raw = m[1].replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
          const parts = raw.split(/\s*[-–|]\s*/);
          const nameCandidate = parts[0]?.trim();
          if (nameCandidate && /^[A-Z][a-z]+(?:\s+[A-Z][a-z\-']+)+$/.test(nameCandidate)) {
            dmName = nameCandidate;
            dmSource = "linkedin_search";
          }
        }
      }
    } catch { /* fall through */ }


    const nextAttempts = (contact.dm_search_attempts || 0) + 1;

    if (!dmName) {
      await supabase.from("contacts").update({
        dm_search_attempts: nextAttempts,
        dm_last_retry_at: new Date().toISOString(),
      }).eq("id", contact.id).eq("team_id", team_id);
      return { ok: true, found: false, message: `No decision maker found on attempt #${nextAttempts}. Try again later or add manually.` };
    }

    // Found a DM — upgrade the contact and move pipeline stage
    await supabase.from("contacts").update({
      name: dmName,
      business_only: false,
      dm_search_attempts: nextAttempts,
      dm_last_retry_at: new Date().toISOString(),
      verification_sources: [dmSource || "retry"],
    }).eq("id", contact.id).eq("team_id", team_id);

    const { data: newLeadStage } = await supabase
      .from("pipeline_stages").select("id").eq("team_id", team_id).eq("position", 0).maybeSingle();
    if (newLeadStage?.id) {
      await supabase.from("pipeline_leads")
        .update({ stage_id: newLeadStage.id })
        .eq("team_id", team_id).eq("contact_id", contact.id);
    }
    // Charge the remaining 0.5 credit for upgrading business-only → DM
    await supabase.rpc("consume_credits", { _team_id: team_id, _amount: 0.5, _kind: "discovery_dm_upgrade" });

    return { ok: true, found: true, name: dmName, message: `Decision maker found: ${dmName}` };
  });

