// Server-only notification dispatcher with per-channel adapters,
// formatters, and a retry queue. Do not import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationEvent =
  | "campaign_milestone"
  | "campaign_paused"
  | "zero_replies"
  | "high_cost_per_lead"
  | "campaign_complete"
  | "workflow_executed"
  | "list_building_complete"
  | "login_approval"
  | "system_alert";

export type Channel = "slack" | "whatsapp" | "discord" | "telegram";

export interface EventData {
  campaign_name?: string;
  workflow_name?: string;
  list_name?: string;
  email?: string;
  count?: number;
  replies?: number;
  reply_rate?: number;
  bounce_rate?: number;
  threshold?: number;
  cost_per_lead?: number;
  reason?: string;
  link?: string;
  [k: string]: unknown;
}

interface FormattedMessage {
  title: string;
  slack: string;
  whatsapp: string;
  discord: string;
  telegram: string; // markdown
}

const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "?");
const pct = (n?: number) => (typeof n === "number" ? `${n.toFixed(1)}%` : "?");
const money = (n?: number) => (typeof n === "number" ? `$${n.toFixed(2)}` : "?");

function format(event: NotificationEvent, d: EventData): FormattedMessage {
  const link = d.link ?? "";
  switch (event) {
    case "campaign_milestone": {
      const title = "🚀 Campaign Milestone";
      const body = `Campaign: ${d.campaign_name}\nSent: ${fmt(d.count)} records\nStatus: ✅ Active`;
      return {
        title,
        slack: `*${title}*\n${body}${link ? `\n<${link}|View Dashboard>` : ""}`,
        discord: `:rocket: **${title}**\n${body}${link ? `\n[View Dashboard](${link})` : ""}`,
        telegram: `*${title}*\n${body}${link ? `\n[View Dashboard](${link})` : ""}`,
        whatsapp: `${title}\n\n${body}${link ? `\n\nView: ${link}` : ""}`,
      };
    }
    case "campaign_paused": {
      const title = "⏸ Campaign Paused";
      const body = `Campaign: ${d.campaign_name}\nReason: ${d.reason ?? `bounce rate ${pct(d.bounce_rate)} (threshold ${pct(d.threshold)})`}`;
      return {
        title,
        slack: `*${title}*\n${body}${link ? `\n<${link}|Review>` : ""}`,
        discord: `:pause_button: **${title}**\n${body}${link ? `\n[Review](${link})` : ""}`,
        telegram: `*${title}*\n${body}${link ? `\n[Review](${link})` : ""}`,
        whatsapp: `${title}\n\n${body}${link ? `\n\nReview: ${link}` : ""}`,
      };
    }
    case "zero_replies": {
      const title = "⚠️ Zero Replies";
      const body = `Campaign: ${d.campaign_name}\n0 replies after ${fmt(d.count)} sends`;
      return {
        title,
        slack: `*${title}*\n${body}`,
        discord: `:warning: **${title}**\n${body}`,
        telegram: `*${title}*\n${body}`,
        whatsapp: `${title}\n\n${body}`,
      };
    }
    case "high_cost_per_lead": {
      const title = "💸 High Cost Per Lead";
      const body = `Campaign: ${d.campaign_name}\nCPL: ${money(d.cost_per_lead)} (threshold ${money(d.threshold)})`;
      return {
        title,
        slack: `*${title}*\n${body}`,
        discord: `:money_with_wings: **${title}**\n${body}`,
        telegram: `*${title}*\n${body}`,
        whatsapp: `${title}\n\n${body}`,
      };
    }
    case "campaign_complete": {
      const title = "🎯 Campaign Complete";
      const body = `Campaign: ${d.campaign_name}\nSent: ${fmt(d.count)} • Replies: ${fmt(d.replies)} (${pct(d.reply_rate)})`;
      return {
        title,
        slack: `*${title}*\n${body}${link ? `\n<${link}|Open>` : ""}`,
        discord: `:dart: **${title}**\n${body}${link ? `\n[Open](${link})` : ""}`,
        telegram: `*${title}*\n${body}${link ? `\n[Open](${link})` : ""}`,
        whatsapp: `${title}\n\n${body}${link ? `\n\nOpen: ${link}` : ""}`,
      };
    }
    case "workflow_executed": {
      const title = "🔁 Workflow Executed";
      const body = `Workflow: ${d.workflow_name}\nProcessed: ${fmt(d.count)} records`;
      return {
        title,
        slack: `*${title}*\n${body}`,
        discord: `:repeat: **${title}**\n${body}`,
        telegram: `*${title}*\n${body}`,
        whatsapp: `${title}\n\n${body}`,
      };
    }
    case "list_building_complete": {
      const title = "📋 List Building Complete";
      const body = `List: ${d.list_name ?? "—"}\nProspects found: ${fmt(d.count)}`;
      return {
        title,
        slack: `*${title}*\n${body}${link ? `\n<${link}|View>` : ""}`,
        discord: `:clipboard: **${title}**\n${body}${link ? `\n[View](${link})` : ""}`,
        telegram: `*${title}*\n${body}${link ? `\n[View](${link})` : ""}`,
        whatsapp: `${title}\n\n${body}${link ? `\n\nView: ${link}` : ""}`,
      };
    }
    case "login_approval": {
      const title = "🔐 New Login Request";
      const body = `Email: ${d.email}\nClick to approve or deny.`;
      return {
        title,
        slack: `*${title}*\n${body}${link ? `\n<${link}|Open approvals>` : ""}`,
        discord: `:lock: **${title}**\n${body}${link ? `\n[Open approvals](${link})` : ""}`,
        telegram: `*${title}*\n${body}${link ? `\n[Open approvals](${link})` : ""}`,
        whatsapp: `${title}\n\n${body}${link ? `\n\nOpen: ${link}` : ""}`,
      };
    }
    case "system_alert": {
      const title = "🚨 System Alert";
      const body = d.reason ?? "Manual review needed.";
      return {
        title,
        slack: `*${title}*\n${body}`,
        discord: `:rotating_light: **${title}**\n${body}`,
        telegram: `*${title}*\n${body}`,
        whatsapp: `${title}\n\n${body}`,
      };
    }
  }
}

// ───── Adapters ─────────────────────────────────────────────────

async function sendSlack(webhook: string, text: string) {
  const r = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`Slack ${r.status}: ${await r.text()}`);
}

async function sendDiscord(webhook: string, content: string) {
  const r = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok && r.status !== 204) throw new Error(`Discord ${r.status}: ${await r.text()}`);
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`);
}

async function sendWhatsApp(phoneId: string, accessToken: string, to: string, body: string) {
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${await r.text()}`);
}

// ───── Dispatch ─────────────────────────────────────────────────

interface TeamSettings {
  slack_webhook: string | null;
  whatsapp_phone_id: string | null;
  whatsapp_access_token: string | null;
  whatsapp_default_to: string | null;
  discord_webhook_url: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  notification_prefs: any;
}

async function sendOne(
  channel: Channel,
  s: TeamSettings,
  msg: FormattedMessage,
): Promise<void> {
  switch (channel) {
    case "slack":
      if (!s.slack_webhook) throw new Error("Slack webhook not configured");
      return sendSlack(s.slack_webhook, msg.slack);
    case "discord":
      if (!s.discord_webhook_url) throw new Error("Discord webhook not configured");
      return sendDiscord(s.discord_webhook_url, msg.discord);
    case "telegram":
      if (!s.telegram_bot_token || !s.telegram_chat_id)
        throw new Error("Telegram not configured");
      return sendTelegram(s.telegram_bot_token, s.telegram_chat_id, msg.telegram);
    case "whatsapp":
      if (!s.whatsapp_phone_id || !s.whatsapp_access_token || !s.whatsapp_default_to)
        throw new Error("WhatsApp not configured");
      return sendWhatsApp(
        s.whatsapp_phone_id,
        s.whatsapp_access_token,
        s.whatsapp_default_to,
        msg.whatsapp,
      );
  }
}

async function logDelivery(args: {
  teamId: string;
  channel: Channel;
  eventType: NotificationEvent;
  status: "sent" | "failed" | "skipped";
  title?: string;
  summary?: string;
  error?: string;
  attempt?: number;
}) {
  try {
    await supabaseAdmin.from("notifications_log" as any).insert({
      team_id: args.teamId,
      channel: args.channel,
      event_type: args.eventType,
      status: args.status,
      title: args.title ?? null,
      summary: args.summary ?? null,
      error: args.error ?? null,
      attempt: args.attempt ?? 1,
    } as any);
  } catch {
    /* swallow logging errors */
  }
}

async function enqueueRetry(
  teamId: string,
  channel: Channel,
  eventType: NotificationEvent,
  msg: FormattedMessage,
  err: string,
  attempts = 1,
) {
  const minutes = Math.min(2 ** attempts, 60);
  await supabaseAdmin.from("notification_queue").insert({
    team_id: teamId,
    channel,
    event_type: eventType,
    payload: msg as any,
    status: "pending",
    attempts,
    last_error: err,
    next_retry_at: new Date(Date.now() + minutes * 60_000).toISOString(),
  });
}

export async function dispatchNotification(args: {
  teamId: string;
  eventType: NotificationEvent;
  data: EventData;
  overrideChannels?: Channel[];
}): Promise<{ sent: Channel[]; queued: Channel[]; skipped: Channel[] }> {
  const { teamId, eventType, data } = args;
  const { data: settings } = await supabaseAdmin
    .from("team_settings")
    .select(
      "slack_webhook, whatsapp_phone_id, whatsapp_access_token, whatsapp_default_to, discord_webhook_url, telegram_bot_token, telegram_chat_id, notification_prefs",
    )
    .eq("team_id", teamId)
    .maybeSingle();
  if (!settings) return { sent: [], queued: [], skipped: [] };

  const prefs = (settings.notification_prefs ?? {}) as any;
  const eventEnabled = prefs?.events?.[eventType] !== false;
  if (!eventEnabled) return { sent: [], queued: [], skipped: [] };

  const allChannels: Channel[] = ["slack", "whatsapp", "discord", "telegram"];
  // Per-event routing: prefs.eventChannels[eventType] = Channel[]
  const routed: Channel[] | undefined = Array.isArray(prefs?.eventChannels?.[eventType])
    ? (prefs.eventChannels[eventType] as Channel[]).filter((c) => allChannels.includes(c))
    : undefined;
  const channels: Channel[] =
    args.overrideChannels ??
    (routed && routed.length
      ? routed.filter((c) => prefs?.channels?.[c])
      : allChannels.filter((c) => prefs?.channels?.[c]));

  const msg = format(eventType, data);
  const sent: Channel[] = [];
  const queued: Channel[] = [];
  const skipped: Channel[] = [];
  const summary =
    (data.reason as string | undefined) ??
    (data.campaign_name as string | undefined) ??
    (data.workflow_name as string | undefined);

  await Promise.all(
    channels.map(async (ch) => {
      try {
        await sendOne(ch, settings as TeamSettings, msg);
        sent.push(ch);
        await logDelivery({ teamId, channel: ch, eventType, status: "sent", title: msg.title, summary });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        await enqueueRetry(teamId, ch, eventType, msg, err, 1);
        queued.push(ch);
        await logDelivery({ teamId, channel: ch, eventType, status: "failed", title: msg.title, summary, error: err });
      }
    }),
  );

  if (routed) {
    for (const ch of routed) {
      if (!channels.includes(ch)) {
        skipped.push(ch);
        await logDelivery({ teamId, channel: ch, eventType, status: "skipped", title: msg.title, summary, error: "channel disabled" });
      }
    }
  }

  return { sent, queued, skipped };
}

export async function processRetryQueue(limit = 50) {
  const { data: rows } = await supabaseAdmin
    .from("notification_queue")
    .select("*")
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);
  if (!rows?.length) return { processed: 0, failed: 0, dead: 0 };

  let processed = 0, failed = 0, dead = 0;
  for (const row of rows) {
    const { data: settings } = await supabaseAdmin
      .from("team_settings")
      .select(
        "slack_webhook, whatsapp_phone_id, whatsapp_access_token, whatsapp_default_to, discord_webhook_url, telegram_bot_token, telegram_chat_id, notification_prefs",
      )
      .eq("team_id", row.team_id)
      .maybeSingle();
    if (!settings) {
      await supabaseAdmin.from("notification_queue").update({ status: "dead", last_error: "team settings missing" }).eq("id", row.id);
      dead++;
      continue;
    }
    const msg = row.payload as unknown as FormattedMessage;
    try {
      await sendOne(row.channel as Channel, settings as TeamSettings, msg);
      await supabaseAdmin.from("notification_queue").update({ status: "sent" }).eq("id", row.id);
      processed++;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const attempts = (row.attempts ?? 0) + 1;
      if (attempts >= 5) {
        await supabaseAdmin.from("notification_queue").update({ status: "dead", attempts, last_error: err }).eq("id", row.id);
        dead++;
      } else {
        const minutes = Math.min(2 ** attempts, 60);
        await supabaseAdmin.from("notification_queue").update({
          attempts,
          last_error: err,
          next_retry_at: new Date(Date.now() + minutes * 60_000).toISOString(),
        }).eq("id", row.id);
        failed++;
      }
    }
  }
  return { processed, failed, dead };
}

export { format as formatNotification };
