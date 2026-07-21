import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/brand/$sub")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.sub || "").toLowerCase();
        if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug)) {
          return new Response("Bad subdomain", { status: 400 });
        }
        const { data } = await supabaseAdmin
          .from("teams")
          .select("id, white_label_name, white_label_color, white_label_secondary_color, white_label_logo")
          .ilike("subdomain", slug)
          .maybeSingle();
        if (!data) return Response.json({ found: false }, { headers: { "Cache-Control": "public, max-age=60" } });
        return Response.json(
          {
            found: true,
            name: (data as any).white_label_name,
            primary: (data as any).white_label_color,
            secondary: (data as any).white_label_secondary_color,
            logo: (data as any).white_label_logo,
          },
          { headers: { "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
