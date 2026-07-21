import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/proposal-view")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      } }),
      POST: async ({ request }) => {
        const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
        try {
          const { token } = await request.json() as { token?: string };
          if (!token) return new Response(JSON.stringify({ error: "missing token" }), { status: 400, headers: cors });

          const { data: p } = await supabaseAdmin
            .from("proposals").select("*").eq("token", token).maybeSingle();
          if (!p) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
          if (p.expires_at && new Date(p.expires_at) < new Date()) {
            return new Response(JSON.stringify({ error: "expired" }), { status: 410, headers: cors });
          }

          // increment view + mark viewed
          const now = new Date().toISOString();
          await supabaseAdmin.from("proposals").update({
            view_count: (p.view_count ?? 0) + 1,
            last_viewed_at: now,
            first_viewed_at: p.first_viewed_at ?? now,
            status: p.status === "sent" ? "viewed" : p.status,
          }).eq("id", p.id);

          // team branding
          const { data: team } = await supabaseAdmin
            .from("teams").select("name,white_label_name,white_label_color,white_label_logo")
            .eq("id", p.team_id).single();

          return new Response(JSON.stringify({
            proposal: {
              prospect_name: p.prospect_name,
              business_name: p.business_name,
              industry: p.industry,
              location: p.location,
              current_lead_method: p.current_lead_method,
              monthly_lead_goal: p.monthly_lead_goal,
              notes: p.notes,
              package_selected: p.package_selected,
              package_price: p.package_price,
              guarantee_text: p.guarantee_text,
              testimonial: p.testimonial,
              cta_url: p.cta_url,
              sample_leads: p.sample_leads ?? [],
              expires_at: p.expires_at,
            },
            agency: {
              name: team?.white_label_name || team?.name || "Your Agency",
              color: team?.white_label_color || null,
              logo: team?.white_label_logo || null,
            },
          }), { status: 200, headers: cors });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message || "error" }), { status: 500, headers: cors });
        }
      },
    },
  },
});
