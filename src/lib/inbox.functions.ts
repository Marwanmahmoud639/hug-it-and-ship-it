import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OPT_OUT_RE = /\b(stop|unsubscribe|opt[- ]?out|remove me|quit|cancel|end)\b/i;

async function getTeamId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
  if (!data?.team_id) throw new Error("No team");
  return data.team_id as string;
}

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    channel: z.enum(["all", "email", "sms", "whatsapp"]).default("all"),
    filter: z.enum(["all", "unread", "needs_reply"]).default("all"),
    q: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const team_id = await getTeamId(supabase, userId);
    let q = supabase
      .from("messages")
      .select("id, contact_id, channel, direction, subject, body, status, read_at, created_at, from_address, to_address")
      .eq("team_id", team_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.channel !== "all") q = q.eq("channel", data.channel);
    const { data: msgs } = await q;
    const byContact = new Map<string, any>();
    for (const m of msgs ?? []) {
      const key = m.contact_id ?? `_${m.from_address ?? m.to_address}`;
      if (!byContact.has(key)) {
        byContact.set(key, { contact_id: m.contact_id, last: m, unread: 0, channel: m.channel });
      }
      if (m.direction === "inbound" && !m.read_at) byContact.get(key).unread++;
    }
    const contactIds = [...byContact.keys()].filter((k) => !k.startsWith("_"));
    let contactsMap = new Map<string, any>();
    if (contactIds.length) {
      const { data: contacts } = await supabase
        .from("contacts").select("id, name, company, email, phone").in("id", contactIds);
      for (const c of contacts ?? []) contactsMap.set(c.id, c);
    }
    let convos = [...byContact.values()].map((v) => ({
      ...v, contact: v.contact_id ? contactsMap.get(v.contact_id) ?? null : null,
    }));
    if (data.filter === "unread") convos = convos.filter((c) => c.unread > 0);
    if (data.filter === "needs_reply")
      convos = convos.filter((c) => c.last.direction === "inbound" && !c.last.replied_at);
    if (data.q) {
      const k = data.q.toLowerCase();
      convos = convos.filter((c) =>
        (c.contact?.name ?? "").toLowerCase().includes(k) ||
        (c.last.body ?? "").toLowerCase().includes(k));
    }
    return { conversations: convos };
  });

export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const team_id = await getTeamId(supabase, userId);
    const { data: contact } = await supabase
      .from("contacts").select("*").eq("id", data.contactId).eq("team_id", team_id).maybeSingle();
    if (!contact) throw new Error("not found");
    const { data: messages } = await supabase
      .from("messages").select("*").eq("team_id", team_id).eq("contact_id", data.contactId)
      .order("created_at", { ascending: true });
    return { contact, messages: messages ?? [] };
  });

export const sendReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    contactId: z.string().uuid(),
    channel: z.enum(["email", "sms", "whatsapp"]),
    subject: z.string().max(500).optional(),
    body: z.string().min(1).max(10000),
    aiSuggested: z.boolean().optional(),
    overrideKeywords: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const team_id = await getTeamId(supabase, userId);

    // Blocked-keyword guard
    const { findBlockedMatches, DEFAULT_BLOCKED_KEYWORDS } = await import("@/lib/blocked-keywords");
    const { data: ts } = await supabase
      .from("team_settings").select("blocked_keywords").eq("team_id", team_id).maybeSingle();
    const list = (ts?.blocked_keywords as string[] | null) ?? DEFAULT_BLOCKED_KEYWORDS;
    const scanText = `${data.subject ?? ""}\n${data.body}`;
    const matches = findBlockedMatches(scanText, list);
    if (matches.length > 0) {
      if (data.channel === "sms" || data.channel === "whatsapp") {
        throw new Error(`Message blocked — contains restricted terms: ${matches.join(", ")}`);
      }
      // email: allow override (admin/manager only)
      if (!data.overrideKeywords) {
        throw new Error(`Email contains restricted terms: ${matches.join(", ")}. Override required to send.`);
      }
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", userId).eq("team_id", team_id).maybeSingle();
      const allowed = roleRow?.role === "admin" || roleRow?.role === "manager";
      if (!allowed) {
        throw new Error("Only admins or managers can override blocked-keyword warnings.");
      }
      await supabase.from("activity_log").insert({
        team_id, contact_id: data.contactId,
        action: "blocked_keyword_override",
        note: `Email sent with override — matched: ${matches.join(", ")}`,
      });
    }

    const { data: contact } = await supabase
      .from("contacts").select("email, phone, whatsapp_number")
      .eq("id", data.contactId).eq("team_id", team_id).maybeSingle();
    if (!contact) throw new Error("contact not found");
    const to =
      data.channel === "email" ? contact.email :
      data.channel === "sms" ? contact.phone :
      contact.whatsapp_number ?? contact.phone;
    const { data: msg, error } = await supabase.from("messages").insert({
      team_id, contact_id: data.contactId,
      direction: "outbound", channel: data.channel,
      subject: data.subject ?? null, body: data.body,
      to_address: to, status: "sent",
      ai_suggested: data.aiSuggested ?? false,
    }).select().single();
    if (error) throw error;
    await supabase.from("contacts").update({
      last_message_channel: data.channel,
      last_message_at: new Date().toISOString(),
    }).eq("id", data.contactId);
    return { message: msg };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const team_id = await getTeamId(supabase, userId);
    await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("team_id", team_id).eq("contact_id", data.contactId)
      .eq("direction", "inbound").is("read_at", null);
    await supabase.from("contacts").update({ unread_count: 0 }).eq("id", data.contactId);
    return { ok: true };
  });

export const aiSuggestReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const team_id = await getTeamId(supabase, userId);
    const { data: contact } = await supabase.from("contacts").select("name, company, title")
      .eq("id", data.contactId).eq("team_id", team_id).maybeSingle();
    const { data: messages } = await supabase.from("messages")
      .select("direction, channel, body, created_at")
      .eq("team_id", team_id).eq("contact_id", data.contactId)
      .order("created_at", { ascending: true }).limit(20);
    const transcript = (messages ?? []).map((m: any) =>
      `${m.direction === "inbound" ? "PROSPECT" : "US"}: ${m.body}`).join("\n");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { suggestion: "", error: "AI gateway not configured" };
    const prompt = `You are an SDR replying to a prospect. Suggest a concise, friendly reply (max 4 sentences).
Prospect: ${contact?.name ?? ""}${contact?.title ? `, ${contact.title}` : ""}${contact?.company ? ` at ${contact.company}` : ""}.

Conversation:
${transcript}

Write only the reply text, no preamble.`;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return { suggestion: "", error: `http ${res.status}` };
      const j: any = await res.json();
      const text = j.choices?.[0]?.message?.content ?? "";
      return { suggestion: text };
    } catch (e: any) {
      return { suggestion: "", error: e?.message ?? "error" };
    }
  });

/** Internal helper used by inbound webhooks to record a message. */
export async function recordInboundMessage(opts: {
  supabase: any; team_id: string; contact_id: string | null;
  channel: "email" | "sms" | "whatsapp"; body: string;
  subject?: string | null; from_address?: string | null; to_address?: string | null;
  raw?: any;
}) {
  const isOptOut = OPT_OUT_RE.test(opts.body ?? "");
  await opts.supabase.from("messages").insert({
    team_id: opts.team_id, contact_id: opts.contact_id,
    direction: "inbound", channel: opts.channel,
    subject: opts.subject ?? null, body: opts.body,
    from_address: opts.from_address ?? null, to_address: opts.to_address ?? null,
    status: "received", is_opt_out_detected: isOptOut,
    raw_payload: opts.raw ?? {},
  });
  if (opts.contact_id) {
    await opts.supabase.from("contacts").update({
      last_message_channel: opts.channel,
      last_message_at: new Date().toISOString(),
      unread_count: (1 as any), // increment-ish; UI re-fetches
      opted_out: isOptOut ? true : undefined,
    }).eq("id", opts.contact_id);
    if (isOptOut && opts.from_address) {
      await opts.supabase.from("dnc_suppression_list").insert({
        team_id: opts.team_id,
        phone_or_email: opts.from_address,
        type: opts.channel === "email" ? "email" : "phone",
        source: "inbound_opt_out",
        reason: "Replied STOP/unsubscribe",
      });
    }
  }
  await opts.supabase.from("notifications").insert({
    team_id: opts.team_id,
    title: `New ${opts.channel} reply`,
    body: opts.body.slice(0, 140),
    type: isOptOut ? "warning" : "info",
    link: opts.contact_id ? `/inbox?contact=${opts.contact_id}` : "/inbox",
  });
  return { isOptOut };
}
