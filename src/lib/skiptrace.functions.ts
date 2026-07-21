import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callProvider, PROVIDER_META, type ProviderId, type SkipTracePhone } from "./skiptrace-adapters";

type ProviderConfig = { id: ProviderId; key: string | null };

function buildProviderList(settings: any): ProviderConfig[] {
  const order: string[] = settings?.skip_trace_waterfall_order ?? ["batch", "trestle", "idi", "spokeo", "whitepages"];
  const keyByProvider: Record<ProviderId, string | null> = {
    batch:      settings?.batch_skip_trace_key ?? null,
    trestle:    settings?.trestle_api_key ?? null,
    idi:        settings?.skip_trace_key_2 ?? null,
    spokeo:     settings?.skip_trace_key_3 ?? null,
    whitepages: settings?.skip_trace_key_4 ?? null,
  };
  return order
    .filter((id): id is ProviderId => id in PROVIDER_META)
    .map((id) => ({ id, key: keyByProvider[id] }));
}

export const runSkipTraceWaterfall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { data: contact } = await supabase
      .from("contacts").select("id, name, company, city, state").eq("id", data.contactId).eq("team_id", team_id).maybeSingle();
    if (!contact) throw new Error("contact not found");
    const { data: bi } = await supabase
      .from("business_intel").select("llc_mailing_address").eq("contact_id", contact.id).maybeSingle();
    const { data: settings } = await supabase
      .from("team_settings").select("*").eq("team_id", team_id).maybeSingle();

    const [firstName, ...rest] = (contact.name ?? "").split(" ");
    const lastName = rest.join(" ");
    const input = {
      firstName, lastName,
      company: contact.company, city: contact.city, state: contact.state,
      llcAddress: bi?.llc_mailing_address ?? null,
    };

    const providers = buildProviderList(settings);
    const providersQueried: ProviderId[] = [];
    const aggregated: Map<string, { phone: SkipTracePhone; providers: ProviderId[] }> = new Map();

    for (const p of providers) {
      providersQueried.push(p.id);
      const result = await callProvider(p.id, input, p.key, {
        idiEndpoint: settings?.idi_endpoint_url ?? null,
        idiTemplate: settings?.idi_request_template ?? null,
      });
      // Persist any emails returned (best-effort)
      for (const em of result.emails ?? []) {
        await supabase.from("contact_emails").insert({
          team_id, contact_id: contact.id, email: em.email,
          sources: [p.id], source_type: "direct",
        }).select();
      }
      if (result.phones.length === 0) continue;
      let kept = false;
      for (const ph of result.phones) {
        if (ph.confidence < 60 && aggregated.size === 0) continue;
        kept = true;
        const norm = ph.number.replace(/\D+/g, "");
        const existing = aggregated.get(norm);
        if (existing) {
          existing.providers.push(p.id);
          existing.phone.confidence = Math.min(100, existing.phone.confidence + 15);
        } else {
          aggregated.set(norm, { phone: ph, providers: [p.id] });
        }
      }
      if (kept) break;
    }

    let inserted = 0;
    for (const entry of aggregated.values()) {
      const merged = entry.providers.length;
      const conf = entry.phone.confidence
        + (merged >= 2 ? 20 : 0)
        + (merged >= 3 ? 10 : 0)
        + (entry.phone.type === "mobile" ? 15 : 0);
      const { data: inserted_row } = await supabase.from("contact_phones").insert({
        team_id, contact_id: contact.id,
        phone_number: entry.phone.number,
        line_type: entry.phone.type,
        confidence_score: Math.min(100, conf),
        sources: entry.providers,
        is_sms_eligible: entry.phone.type === "mobile",
        verified: merged >= 2,
      }).select("id").maybeSingle();
      // Queue automatic carrier lookup
      if (inserted_row?.id) {
        await supabase.from("job_queue").insert({
          team_id, job_type: "carrier_lookup", payload: { phone_id: inserted_row.id },
        });
      }
      inserted++;
    }

    return {
      providersQueried,
      providersReturned: Array.from(new Set(Array.from(aggregated.values()).flatMap((e) => e.providers))),
      uniqueNumbers: inserted,
    };
  });
