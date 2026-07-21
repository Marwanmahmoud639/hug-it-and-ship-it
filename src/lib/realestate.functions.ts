import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookupAttom, lookupBatchLeads, lookupPropStream } from "./realestate-adapters";
import { isRealEstateContext, looksLikeLLC, SOS_SUPPORTED_STATES, type SosState } from "./llc-patterns";

export const enrichRealEstate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { data: contact } = await supabase
      .from("contacts").select("id, company, industry, discovery_keyword, state")
      .eq("id", data.contactId).eq("team_id", team_id).maybeSingle();
    if (!contact) throw new Error("contact not found");
    if (!isRealEstateContext(contact.industry, contact.discovery_keyword) && !looksLikeLLC(contact.company)) {
      return { skipped: true, reason: "not real estate" };
    }
    const { data: settings } = await supabase
      .from("team_settings").select("attom_api_key, propstream_api_key, batchleads_api_key").eq("team_id", team_id).maybeSingle();
    const company = contact.company ?? "";
    const [attom, propstream, batch] = await Promise.all([
      lookupAttom(company, settings?.attom_api_key),
      lookupPropStream(company, settings?.propstream_api_key),
      lookupBatchLeads(company, settings?.batchleads_api_key),
    ]);
    // Merge: prefer non-mock; otherwise pick highest properties count.
    const candidates = [attom, propstream, batch].sort((a, b) =>
      (Number(!a.isMock) - Number(!b.isMock)) * -1 || (b.propertiesOwned - a.propertiesOwned),
    );
    const best = candidates[0];
    await supabase.from("business_intel").upsert({
      team_id, contact_id: contact.id,
      is_real_estate_investor: true,
      properties_owned: best.propertiesOwned,
      recent_transactions_12mo: best.recentTransactions12mo,
      llc_registered_agent: best.llcRegisteredAgent,
      llc_mailing_address: best.llcMailingAddress,
      portfolio_size: best.portfolioSize,
      active_buyer_signal: best.activeBuyerSignal,
      last_transaction_date: best.lastTransactionDate,
      attom_last_checked: new Date().toISOString(),
    }, { onConflict: "contact_id" });

    // Enqueue SOS lookup if state is supported
    const stateU = (contact.state ?? "").toUpperCase();
    if ((SOS_SUPPORTED_STATES as readonly string[]).includes(stateU) && company) {
      await supabase.from("job_queue").insert({
        team_id, job_type: "sos_lookup",
        payload: { contact_id: contact.id, llc_name: company, state: stateU as SosState },
      });
    }
    return { ok: true, source: best.source, mocked: best.isMock };
  });
