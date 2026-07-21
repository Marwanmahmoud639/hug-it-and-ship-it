import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { recordInboundMessage } from "@/lib/inbox.functions";

/**
 * Inbound SMS webhook (Twilio / SignalWire / Telnyx compatible).
 * Auth: ?team=<team_id>&token=<inbox_sms_webhook_secret>
 *
 * Twilio posts application/x-www-form-urlencoded with From/To/Body.
 * Telnyx posts JSON with data.payload.from.phone_number etc.
 */
export const Route = createFileRoute("/api/public/webhooks/inbound-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const teamId = url.searchParams.get("team");
        const token = url.searchParams.get("token");
        if (!teamId || !token) return new Response("missing params", { status: 400 });

        const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data: settings } = await db.from("team_settings")
          .select("inbox_sms_webhook_secret").eq("team_id", teamId).maybeSingle();
        if (!settings || (settings as any).inbox_sms_webhook_secret !== token) {
          return new Response("unauthorized", { status: 401 });
        }

        const ct = request.headers.get("content-type") ?? "";
        let from = "", to = "", body = "", raw: any = {};
        if (ct.includes("application/json")) {
          raw = await request.json();
          const p = raw?.data?.payload ?? raw;
          from = p.from?.phone_number ?? p.from ?? "";
          to = p.to?.[0]?.phone_number ?? p.to ?? "";
          body = p.text ?? p.body ?? "";
        } else {
          const form = await request.formData();
          raw = Object.fromEntries(form.entries());
          from = String(raw.From ?? "");
          to = String(raw.To ?? "");
          body = String(raw.Body ?? "");
        }
        if (!from || !body) return new Response("bad payload", { status: 400 });

        const digits = from.replace(/\D+/g, "");
        const { data: phoneRow } = await db.from("contact_phones")
          .select("contact_id").eq("team_id", teamId)
          .ilike("phone_number", `%${digits.slice(-10)}%`).maybeSingle();
        const contactId = phoneRow?.contact_id ?? null;

        await recordInboundMessage({
          supabase: db, team_id: teamId, contact_id: contactId,
          channel: "sms", body, from_address: from, to_address: to, raw,
        });
        // Twilio expects TwiML or 200
        return new Response("<Response/>", {
          status: 200, headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
