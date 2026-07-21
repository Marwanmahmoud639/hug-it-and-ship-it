import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchNotification } from "@/lib/notifications.server";

// Public endpoint called by the login page after a pending login request is created.
// No CRON_SECRET required — abuse is bounded by the existing request_login rate
// limit (max 3 pending rows / email / hour) and we only ever notify the row that
// is already pending in the DB.
export const Route = createFileRoute("/api/public/hooks/login-request-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let requestId: string | undefined;
        try {
          const body = (await request.json()) as { requestId?: string };
          requestId = body?.requestId;
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        if (!requestId || typeof requestId !== "string") {
          return new Response("requestId required", { status: 400 });
        }

        const { data: req } = await supabaseAdmin
          .from("login_requests")
          .select("id, email, ip_address, user_agent, status")
          .eq("id", requestId)
          .maybeSingle();
        if (!req || req.status !== "pending") {
          return Response.json({ ok: false, reason: "not_pending" });
        }

        // Resolve all super-admin teams
        const { data: admins } = await supabaseAdmin
          .from("super_admins")
          .select("user_id");
        if (!admins?.length) return Response.json({ ok: true, notified: 0 });

        const userIds = admins.map((a) => a.user_id);
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, team_id")
          .in("id", userIds);
        const teamIds = Array.from(
          new Set((profs ?? []).map((p) => p.team_id).filter(Boolean) as string[]),
        );

        const origin = new URL(request.url).origin;
        const link = `${origin}/super-admin?request=${req.id}`;

        let notified = 0;
        await Promise.all(
          teamIds.map(async (teamId) => {
            try {
              await dispatchNotification({
                teamId,
                eventType: "login_approval",
                data: {
                  email: req.email,
                  reason: `IP: ${req.ip_address ?? "—"} • UA: ${(req.user_agent ?? "").slice(0, 80)}`,
                  link,
                },
              });
              notified++;
            } catch (e) {
              console.error("login_approval dispatch failed", teamId, e);
            }
          }),
        );

        return Response.json({ ok: true, notified });
      },
    },
  },
});
