import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function maskEmail(e: string | null) {
  if (!e) return null;
  const [u, d] = e.split("@");
  if (!d) return "***";
  return `${u[0] ?? "*"}***@${d}`;
}
function maskPhone(p: string | null) {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***-***-${digits.slice(-4)}`;
}

export const Route = createFileRoute("/api/public/portal-view")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } }),
      POST: async ({ request }) => {
        const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
        try {
          const { token } = await request.json() as { token?: string };
          if (!token) return new Response(JSON.stringify({ error: "missing token" }), { status: 400, headers: cors });

          const { data: portal } = await supabaseAdmin
            .from("client_portals").select("*").eq("token", token).maybeSingle();
          if (!portal || !portal.active) {
            return new Response(JSON.stringify({ error: "expired" }), { status: 404, headers: cors });
          }
          if (portal.expires_at && new Date(portal.expires_at) < new Date()) {
            return new Response(JSON.stringify({ error: "expired" }), { status: 404, headers: cors });
          }

          // increment views
          await supabaseAdmin.from("client_portals")
            .update({ view_count: (portal.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
            .eq("id", portal.id);

          // team branding
          const { data: team } = await supabaseAdmin
            .from("teams").select("name,white_label_name,white_label_color,white_label_logo")
            .eq("id", portal.team_id).single();

          // date window
          const days = portal.date_range === "7d" ? 7 : portal.date_range === "30d" ? 30 : 36500;
          const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();

          // resolve contacts by filter
          let contactQuery = supabaseAdmin.from("contacts")
            .select("id,name,title,company,email,phone,tags,created_at,lead_score")
            .eq("team_id", portal.team_id)
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(100);

          if (portal.filter_type === "tag") {
            contactQuery = contactQuery.contains("tags", [portal.filter_value]);
          }
          // for stage filter, we resolve via pipeline_leads in a moment
          let { data: contacts } = await contactQuery;
          contacts = contacts ?? [];

          if (portal.filter_type === "stage") {
            const { data: stage } = await supabaseAdmin.from("pipeline_stages")
              .select("id").eq("team_id", portal.team_id).eq("name", portal.filter_value).maybeSingle();
            if (stage) {
              const { data: leads } = await supabaseAdmin.from("pipeline_leads")
                .select("contact_id").eq("team_id", portal.team_id).eq("stage_id", stage.id);
              const idSet = new Set((leads ?? []).map((l: any) => l.contact_id));
              contacts = contacts.filter((c: any) => idSet.has(c.id));
            } else {
              contacts = [];
            }
          }

          // activity for these contacts
          const contactIds = contacts.map((c: any) => c.id);
          let activity: any[] = [];
          if (contactIds.length) {
            const { data: acts } = await supabaseAdmin.from("activity_log")
              .select("id,action,channel,note,created_at")
              .eq("team_id", portal.team_id)
              .in("contact_id", contactIds)
              .order("created_at", { ascending: false })
              .limit(20);
            activity = acts ?? [];
          }

          // stat windows: last 7 days
          const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
          const leads_week = contacts.filter((c: any) => c.created_at >= weekAgo).length;
          const calls_week = activity.filter(a => a.channel === "call" && a.created_at >= weekAgo).length;
          const responses_week = activity.filter(a => (a.action === "reply" || a.action === "responded") && a.created_at >= weekAgo).length;
          const stage_changes_week = activity.filter(a => a.action === "stage_change" && a.created_at >= weekAgo).length;

          // mask
          const safeContacts = contacts.map((c: any) => ({
            id: c.id, name: c.name, title: c.title, company: c.company,
            email_masked: maskEmail(c.email), phone_masked: maskPhone(c.phone),
            created_at: c.created_at, lead_score: c.lead_score,
          }));

          const agencyName = team?.white_label_name || team?.name || "Your Agency";

          return new Response(JSON.stringify({
            portal: { name: portal.name, date_range: portal.date_range },
            agency: { name: agencyName, color: team?.white_label_color || null, logo: team?.white_label_logo || null },
            stats: { leads_week, calls_week, responses_week, stage_changes_week },
            contacts: safeContacts,
            activity,
          }), { status: 200, headers: cors });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500, headers: cors });
        }
      },
    },
  },
});
