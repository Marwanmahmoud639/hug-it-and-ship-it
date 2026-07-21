import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const urlSchema = z
  .string()
  .trim()
  .min(1, "URL required")
  .max(2000, "URL too long")
  .url("Invalid URL")
  .refine((u) => /^https?:\/\//i.test(u), "Must be http or https");

const testInput = z.object({
  provider: z.enum(["n8n", "make"]),
  url: urlSchema,
});

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => testInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const payload = {
      event: "connection_test",
      provider: data.provider,
      source: "c4d-launchpad",
      user_id: userId,
      sent_at: new Date().toISOString(),
      message: "Test ping from C4D Launchpad settings.",
    };
    const started = Date.now();
    try {
      const res = await fetch(data.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      const ms = Date.now() - started;
      const body = (await res.text()).slice(0, 300);
      return { ok: res.ok, status: res.status, ms, body };
    } catch (e: any) {
      return { ok: false, status: 0, ms: Date.now() - started, body: e?.message ?? "Request failed" };
    }
  });

const sendInput = z.object({
  provider: z.enum(["n8n", "make"]),
  event: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});

/** Sends a payload to the team's stored n8n or Make webhook. Used by workflow "Send to webhook" actions. */
export const sendToAutomationWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const { data: settings } = await supabase
      .from("team_settings")
      .select("n8n_webhook_url, make_webhook_url")
      .eq("team_id", profile.team_id)
      .maybeSingle();
    const url = data.provider === "n8n" ? settings?.n8n_webhook_url : settings?.make_webhook_url;
    if (!url) throw new Error(`${data.provider.toUpperCase()} webhook is not configured`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: data.event,
        source: "c4d-launchpad",
        team_id: profile.team_id,
        sent_at: new Date().toISOString(),
        data: data.payload,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    return { ok: true, status: res.status };
  });
