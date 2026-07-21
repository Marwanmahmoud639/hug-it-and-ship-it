import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalizePhone(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/[^0-9]/g, "");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "+" + digits;
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!prof?.team_id) return { threads: [] };
    const { data, error } = await supabase
      .from("sms_threads")
      .select("id, phone_number, last_message_at, last_preview, unread_count, contact_id, contact:contacts(id,name)")
      .eq("team_id", prof.team_id)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: thread, error } = await supabase
      .from("sms_threads")
      .select("id, phone_number, last_message_at, contact_id, contact:contacts(id,name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) throw new Error("Thread not found");
    const { data: msgs, error: e2 } = await supabase
      .from("sms_messages")
      .select("id, direction, body, status, from_number, to_number, sent_at")
      .eq("thread_id", data.id)
      .order("sent_at", { ascending: true });
    if (e2) throw new Error(e2.message);
    // mark read
    await supabase.from("sms_threads").update({ unread_count: 0 }).eq("id", data.id);
    return { thread, messages: msgs ?? [] };
  });

export const startThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ to: z.string().min(3).max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!prof?.team_id) throw new Error("No team");
    const phone = normalizePhone(data.to);
    const { data: existing } = await supabase
      .from("sms_threads")
      .select("id")
      .eq("team_id", prof.team_id)
      .eq("phone_number", phone)
      .maybeSingle();
    if (existing) return { threadId: existing.id };
    const { data: contact } = await supabase
      .from("contact_phones")
      .select("contact_id")
      .eq("phone_number", phone)
      .maybeSingle();
    const { data: t, error } = await supabase
      .from("sms_threads")
      .insert({ team_id: prof.team_id, phone_number: phone, contact_id: contact?.contact_id ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { threadId: t.id };
  });

export const sendSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    threadId: z.string().uuid(),
    body: z.string().min(1).max(1600),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: thread, error: te } = await supabase
      .from("sms_threads")
      .select("id, team_id, phone_number")
      .eq("id", data.threadId)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!thread) throw new Error("Thread not found");

    const { loadActiveProviderForTeam } = await import("@/lib/dialer/registry");
    const active = await loadActiveProviderForTeam(thread.team_id);

    let providerId = "twilio";
    let fromNumber: string;
    let sendResult: { providerMessageId: string | null; status: string };

    if (active) {
      providerId = active.adapter.id;
      fromNumber = active.row.from_number ?? "";
      if (!fromNumber) throw new Error(`${active.adapter.label}: no from_number configured`);
      sendResult = await active.adapter.sendSms(
        active.row.credentials ?? {},
        fromNumber,
        { to: thread.phone_number, body: data.body },
      );
    } else {
      // Fallback to env-based Twilio for backwards compat
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      fromNumber = process.env.TWILIO_CALLER_ID ?? "";
      if (!accountSid || !authToken || !fromNumber) {
        throw new Error("No dialer provider configured. Add one in Settings → Dialer Providers.");
      }
      const { twilioProvider } = await import("@/lib/dialer/twilio");
      sendResult = await twilioProvider.sendSms(
        { account_sid: accountSid, auth_token: authToken },
        fromNumber,
        { to: thread.phone_number, body: data.body },
      );
    }

    await supabase.from("sms_messages").insert({
      thread_id: thread.id,
      team_id: thread.team_id,
      direction: "outbound",
      body: data.body,
      status: sendResult.status,
      twilio_sid: sendResult.providerMessageId,
      from_number: fromNumber,
      to_number: thread.phone_number,
      sent_by: userId,
    });
    await supabase.from("sms_threads").update({
      last_message_at: new Date().toISOString(),
      last_preview: data.body.slice(0, 120),
    }).eq("id", thread.id);

    return { ok: true, sid: sendResult.providerMessageId, provider: providerId };
  });


export const listSmsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!prof?.team_id) return { messages: [] };
    const { data, error } = await supabase
      .from("sms_messages")
      .select("id, direction, body, sent_at, from_number, to_number, status")
      .eq("team_id", prof.team_id)
      .order("sent_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });
