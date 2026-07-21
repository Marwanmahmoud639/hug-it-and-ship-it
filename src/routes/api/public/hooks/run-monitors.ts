import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronSecret } from "@/lib/cron-auth.server";

// Hourly cron entry. Picks active monitors due now, kicks off Discovery for each
// by enqueuing a job_queue row that the existing discovery worker will pick up.
// Protected with the CRON_SECRET shared header.
export const Route = createFileRoute("/api/public/hooks/run-monitors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronSecret(request);
        if (unauth) return unauth;
        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("search_monitors")
          .select("*")
          .eq("status", "active")
          .lte("next_run_at", nowIso);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let queued = 0;
        for (const m of due ?? []) {
          await supabaseAdmin.from("job_queue").insert({
            team_id: m.team_id,
            job_type: "monitor_run",
            payload: {
              monitor_id: m.id,
              keyword: m.keyword,
              location: m.location,
              industry_filter: m.industry_filter,
              title_filters: m.title_filters,
              auto_add_threshold: m.auto_add_threshold,
            },
          });

          // schedule next
          let next: string | null = null;
          const n = new Date();
          if (m.frequency === "weekly") {
            const targetDow = m.frequency_day ?? 1;
            const diff = (targetDow - n.getDay() + 7) % 7 || 7;
            const dt = new Date(n); dt.setDate(n.getDate() + diff); dt.setHours(9, 0, 0, 0);
            next = dt.toISOString();
          } else if (m.frequency === "monthly") {
            const dt = new Date(n.getFullYear(), n.getMonth() + 1, m.frequency_day ?? 1, 9, 0, 0, 0);
            next = dt.toISOString();
          }
          await supabaseAdmin.from("search_monitors").update({
            last_run_at: nowIso, next_run_at: next, total_runs: (m.total_runs ?? 0) + 1,
          }).eq("id", m.id);
          queued++;
        }
        return Response.json({ ok: true, queued });
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run" }),
    },
  },
});
