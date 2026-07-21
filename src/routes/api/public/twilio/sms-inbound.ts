import { createFileRoute } from "@tanstack/react-router";
import { validateTwilioSignature } from "@/lib/twilio.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/twilio/sms-inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url).toString();
        const formText = await request.text();
        const params: Record<string, string> = {};
        new URLSearchParams(formText).forEach((v, k) => { params[k] = v; });

        const signature = request.headers.get("x-twilio-signature");
        if (!signature || !validateTwilioSignature(url, params, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const from = (params.From || "").trim();
        const to = (params.To || "").trim();
        const body = (params.Body || "").trim();
        const sid = (params.MessageSid || "").trim();
        if (!from || !to) {
          return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
            status: 200,
            headers: { "Content-Type": "text/xml" },
          });
        }

        // Find the team that owns this destination number.
        // Simplest mapping: any team — match To against TWILIO_CALLER_ID, fallback to first team.
        // Better: store per-team numbers later.
        const { data: anyThread } = await supabaseAdmin
          .from("sms_threads")
          .select("id, team_id")
          .eq("phone_number", from)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let teamId = anyThread?.team_id as string | undefined;
        let threadId = anyThread?.id as string | undefined;

        if (!teamId) {
          const { data: firstTeam } = await supabaseAdmin
            .from("teams")
            .select("id")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          teamId = firstTeam?.id;
        }
        if (!teamId) {
          return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
            status: 200,
            headers: { "Content-Type": "text/xml" },
          });
        }

        if (!threadId) {
          const { data: contact } = await supabaseAdmin
            .from("contact_phones").select("contact_id").eq("phone_number", from).maybeSingle();
          const { data: t } = await supabaseAdmin
            .from("sms_threads")
            .insert({ team_id: teamId, phone_number: from, contact_id: contact?.contact_id ?? null })
            .select("id")
            .single();
          threadId = t?.id;
        }

        if (threadId) {
          await supabaseAdmin.from("sms_messages").insert({
            thread_id: threadId,
            team_id: teamId,
            direction: "inbound",
            body,
            status: "received",
            twilio_sid: sid || null,
            from_number: from,
            to_number: to,
          });
          await supabaseAdmin.rpc("update_updated_at_column" as any).then(() => null, () => null);
          await supabaseAdmin
            .from("sms_threads")
            .update({
              last_message_at: new Date().toISOString(),
              last_preview: body.slice(0, 120),
              unread_count: ((anyThread as any)?.unread_count ?? 0) + 1,
            })
            .eq("id", threadId);
        }

        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
