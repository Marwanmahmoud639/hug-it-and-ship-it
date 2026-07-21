import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { lookupCarrier } from "@/lib/carrier-adapters";
import { sosLookup } from "@/lib/sos";
import { timezoneFromPhone } from "@/lib/area-code-timezone";
import type { SosState } from "@/lib/llc-patterns";
import { requireCronSecret } from "@/lib/cron-auth.server";

/**
 * Drains compliance / enrichment jobs from job_queue.
 * Protected with the CRON_SECRET shared header.
 */
export const Route = createFileRoute("/api/public/hooks/run-compliance-jobs")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, hint: "POST to drain" }),
      POST: async ({ request }) => {
        const unauth = requireCronSecret(request);
        if (unauth) return unauth;
        const { data: claimed } = await supabaseAdmin.rpc("claim_jobs", {
          _job_types: ["sos_lookup", "carrier_lookup", "dnc_scrub_batch", "timezone_resolve", "reset_sent_today"],
          _limit: 25,
        } as any);
        const jobs = claimed ?? [];

        let processed = 0;
        for (const job of jobs) {
          try {
            await run(job);
            await supabaseAdmin.from("job_queue")
              .update({ status: "complete", completed_at: new Date().toISOString() })
              .eq("id", job.id);
            processed++;
          } catch (e: any) {
            await supabaseAdmin.from("job_queue")
              .update({ status: "failed", last_error: e?.message ?? "error", completed_at: new Date().toISOString() })
              .eq("id", job.id);
          }
        }
        return Response.json({ ok: true, processed });
      },
    },
  },
});

async function run(job: any) {
  const p = job.payload ?? {};
  switch (job.job_type) {
    case "sos_lookup": {
      const { contact_id, state, company_name, proxy_url } = p as {
        contact_id?: string; state?: SosState; company_name?: string; proxy_url?: string;
      };
      if (!contact_id || !state || !company_name) return;
      const { data: contact } = await supabaseAdmin
        .from("contacts").select("team_id").eq("id", contact_id).maybeSingle();
      if (!contact?.team_id) return;
      const result = await sosLookup(state, company_name, proxy_url ?? null);
      await supabaseAdmin.from("business_intel").upsert({
        team_id: contact.team_id,
        contact_id,
        llc_registered_agent: result.registeredAgent,
        sos_last_checked: new Date().toISOString(),
      }, { onConflict: "contact_id" });
      break;
    }
    case "carrier_lookup": {
      const { phone_id, phone, provider, api_key } = p as {
        phone_id?: string; phone?: string; provider?: "twilio" | "numverify" | "telnyx" | null; api_key?: string | null;
      };
      if (!phone_id || !phone) return;
      const r = await lookupCarrier(phone, provider ?? null, api_key ?? null);
      await supabaseAdmin.from("contact_phones").update({
        line_type: r.lineType,
        carrier_name: r.carrierName,
        is_sms_eligible: r.lineType === "mobile" || r.lineType === "voip",
      }).eq("id", phone_id);
      break;
    }
    case "dnc_scrub_batch": {
      const { team_id, contact_ids } = p as { team_id?: string; contact_ids?: string[] };
      if (!team_id || !Array.isArray(contact_ids) || contact_ids.length === 0) return;
      await supabaseAdmin.from("compliance_log").insert({
        team_id,
        contacts_total: contact_ids.length,
        log_data: { kind: "dnc_scrub", provider: "stub", contact_ids },
      });
      break;
    }
    case "timezone_resolve": {
      const { contact_id, phone } = p as { contact_id?: string; phone?: string };
      if (!contact_id || !phone) return;
      const tz = timezoneFromPhone(phone);
      if (tz) {
        await supabaseAdmin.from("contacts").update({
          detected_timezone: tz,
          timezone_source: "area_code",
        }).eq("id", contact_id);
      }
      break;
    }
    case "reset_sent_today": {
      await supabaseAdmin.from("sending_inboxes")
        .update({ sent_today: 0 })
        .gte("sent_today", 0);
      break;
    }
  }
}
