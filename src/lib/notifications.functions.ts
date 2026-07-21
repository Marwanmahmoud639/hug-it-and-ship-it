import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchNotification, processRetryQueue, type Channel, type NotificationEvent } from "./notifications.server";

const CHANNELS = ["slack", "whatsapp", "discord", "telegram"] as const;
const EVENTS = [
  "campaign_milestone", "campaign_paused", "zero_replies", "high_cost_per_lead",
  "campaign_complete", "workflow_executed", "list_building_complete",
  "login_approval", "system_alert",
] as const;

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      channel: z.enum(CHANNELS),
      eventType: z.enum(EVENTS).default("system_alert"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const result = await dispatchNotification({
      teamId: profile.team_id,
      eventType: data.eventType as NotificationEvent,
      data: {
        campaign_name: "Test Campaign",
        count: 5000,
        reason: "This is a test notification from your C4D notification settings.",
        link: "https://leads.dialingfordollars.co",
      },
      overrideChannels: [data.channel as Channel],
    });
    if (result.sent.includes(data.channel as Channel)) return { ok: true, status: "sent" };
    if (result.queued.includes(data.channel as Channel)) return { ok: false, status: "queued", error: "Delivery failed; queued for retry. Check credentials." };
    return { ok: false, status: "skipped", error: "Channel disabled or not configured." };
  });

export const retryQueuedNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return processRetryQueue(100);
  });

export const listNotificationLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) return { rows: [] };
    const { data: rows } = await (supabase as any)
      .from("notifications_log")
      .select("id, channel, event_type, status, title, summary, error, attempt, created_at")
      .eq("team_id", profile.team_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return { rows: rows ?? [] };
  });

