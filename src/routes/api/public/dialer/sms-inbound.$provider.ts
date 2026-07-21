import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/dialer/sms-inbound/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const providerId = params.provider;
        const rawBody = await request.text();
        try {
          const { getProvider } = await import("@/lib/dialer/registry");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const adapter = getProvider(providerId);
          if (!adapter.parseInboundSms) {
            return new Response("Provider has no inbound parser", { status: 400 });
          }

          // Find any team with this provider configured to use its credentials for parsing
          const { data: cfg } = await supabaseAdmin
            .from("team_dialer_providers")
            .select("team_id, credentials")
            .eq("provider", providerId as any)

            .eq("is_active", true)
            .limit(1)
            .maybeSingle();

          const evt = await adapter.parseInboundSms(
            (cfg?.credentials as any) ?? {},
            request,
            rawBody,
          );

          // Match team by the "to" number across configured from_numbers
          const { data: match } = await supabaseAdmin
            .from("team_dialer_providers")
            .select("team_id")
            .eq("provider", providerId as any)
            .eq("from_number", evt.to)
            .maybeSingle();

          const teamId = match?.team_id ?? cfg?.team_id;
          if (!teamId) return new Response("No team matched", { status: 404 });

          // Find or create thread
          const { data: existing } = await supabaseAdmin
            .from("sms_threads")
            .select("id")
            .eq("team_id", teamId)
            .eq("phone_number", evt.from)
            .maybeSingle();

          let threadId = existing?.id as string | undefined;
          if (!threadId) {
            const { data: t } = await supabaseAdmin
              .from("sms_threads")
              .insert({ team_id: teamId, phone_number: evt.from })
              .select("id")
              .single();
            threadId = t?.id;
          }
          if (!threadId) return new Response("Could not create thread", { status: 500 });

          await supabaseAdmin.from("sms_messages").insert({
            thread_id: threadId,
            team_id: teamId,
            direction: "inbound",
            body: evt.body,
            status: "received",
            twilio_sid: evt.providerMessageId,
            from_number: evt.from,
            to_number: evt.to,
          });
          await supabaseAdmin
            .from("sms_threads")
            .update({
              last_message_at: new Date().toISOString(),
              last_preview: evt.body.slice(0, 120),
            })
            .eq("id", threadId);

          return new Response("ok", { status: 200 });
        } catch (e: any) {
          console.error("dialer inbound error", e);
          return new Response(e?.message ?? "error", { status: 500 });
        }
      },
    },
  },
});
