import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requireCronSecret } from "@/lib/cron-auth.server";
import { dispatchNotification } from "@/lib/notifications.server";


type Campaign = {
  id: string;
  team_id: string;
  name: string;
  status: string;
  cost_per_lead_threshold: number | null;
  total_cost: number | null;
};

export const Route = createFileRoute("/api/public/hooks/check-campaign-health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronSecret(request);
        if (unauth) return unauth;
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          return new Response(JSON.stringify({ error: "Missing server config" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const supabase = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: campaigns, error } = await supabase
          .from("campaigns")
          .select("id, team_id, name, status, cost_per_lead_threshold, total_cost")
          .in("status", ["active", "running"]);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: Array<{ id: string; paused: boolean; reason?: string }> = [];

        for (const c of (campaigns ?? []) as Campaign[]) {
          // Aggregate metrics from campaign_contacts
          const { data: rows } = await supabase
            .from("campaign_contacts")
            .select("status, sent_at, bounced_at, replied_at, opened_at, delivered_at")
            .eq("campaign_id", c.id);

          const total_contacts = rows?.length ?? 0;
          const total_sent = rows?.filter(r => !!r.sent_at).length ?? 0;
          const total_delivered = rows?.filter(r => !!r.delivered_at).length ?? 0;
          const total_bounced = rows?.filter(r => !!r.bounced_at).length ?? 0;
          const total_opened = rows?.filter(r => !!r.opened_at).length ?? 0;
          const total_replied = rows?.filter(r => !!r.replied_at).length ?? 0;
          const leads_generated = total_replied;

          const bounce_rate = total_sent > 0 ? total_bounced / total_sent : 0;
          const reply_rate = total_sent > 0 ? total_replied / total_sent : 0;
          const cost = Number(c.total_cost ?? 0);
          const cost_per_lead = leads_generated > 0 ? cost / leads_generated : 0;
          const threshold = Number(c.cost_per_lead_threshold ?? 20);

          // Upsert metrics
          await supabase.from("campaign_metrics").upsert(
            {
              campaign_id: c.id,
              team_id: c.team_id,
              total_contacts,
              total_sent,
              total_delivered,
              total_bounced,
              total_opened,
              total_replied,
              leads_generated,
              bounce_rate,
              reply_rate,
              cost_per_lead,
              last_evaluated_at: new Date().toISOString(),
            },
            { onConflict: "campaign_id" },
          );

          // Evaluate pause conditions
          let reason: string | null = null;
          if (total_sent >= 20 && bounce_rate > 0.05) {
            reason = `Bounce rate ${(bounce_rate * 100).toFixed(1)}% exceeds 5% threshold`;
          } else if (total_sent >= 5000 && total_replied === 0) {
            reason = `0 replies after ${total_sent.toLocaleString()} sends`;
          } else if (cost_per_lead > 0 && cost_per_lead > threshold) {
            reason = `Cost per lead $${cost_per_lead.toFixed(2)} exceeds $${threshold.toFixed(2)} threshold`;
          } else if (total_contacts > 0 && total_sent >= total_contacts) {
            reason = `Completed — all ${total_contacts.toLocaleString()} leads sent`;
          }

          if (reason) {
            await supabase
              .from("campaigns")
              .update({
                status: "paused",
                paused_at: new Date().toISOString(),
                pause_reason: reason,
              })
              .eq("id", c.id);

            // Good performance → prompt user to auto-scale
            const goodPerf = reply_rate > 0.03 && total_sent >= 100;
            const isCompleted = reason.startsWith("Completed");

            await supabase.from("notifications").insert({
              team_id: c.team_id,
              title:
                isCompleted && goodPerf
                  ? `Campaign "${c.name}" completed — ready to scale?`
                  : `Campaign "${c.name}" paused`,
              body:
                isCompleted && goodPerf
                  ? `Sent: ${total_sent.toLocaleString()} · Replies: ${total_replied.toLocaleString()} (${(reply_rate * 100).toFixed(1)}%). Upload 5K more records?`
                  : reason,
              type: isCompleted && goodPerf ? "success" : "warning",
              link: `/campaigns`,
            });

            await supabase.from("activity_log").insert({
              team_id: c.team_id,
              campaign_id: c.id,
              action: isCompleted && goodPerf ? "campaign_ready_to_scale" : "campaign_auto_paused",
              note: reason,
            });

            // External channel notification (Slack/Discord/Telegram/WhatsApp)
            const eventType = isCompleted
              ? "campaign_complete"
              : reason.startsWith("0 replies")
              ? "zero_replies"
              : reason.startsWith("Cost per lead")
              ? "high_cost_per_lead"
              : "campaign_paused";
            try {
              await dispatchNotification({
                teamId: c.team_id,
                eventType,
                data: {
                  campaign_name: c.name,
                  reason,
                  count: total_sent,
                  replies: total_replied,
                  reply_rate: reply_rate * 100,
                  bounce_rate: bounce_rate * 100,
                  cost_per_lead,
                  threshold,
                  link: "/campaigns",
                },
              });
            } catch (e) {
              console.error("dispatchNotification failed", e);
            }

            results.push({ id: c.id, paused: true, reason });
          } else {
            results.push({ id: c.id, paused: false });
          }
        }


        return new Response(
          JSON.stringify({
            success: true,
            evaluated: results.length,
            paused: results.filter(r => r.paused).length,
            results,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
