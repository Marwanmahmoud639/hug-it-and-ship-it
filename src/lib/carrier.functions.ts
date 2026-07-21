import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookupCarrier } from "./carrier-adapters";

export const lookupCarrierForPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phoneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { data: settings } = await supabase
      .from("team_settings")
      .select("carrier_lookup_provider, carrier_lookup_key")
      .eq("team_id", team_id).maybeSingle();
    const { data: phone } = await supabase.from("contact_phones").select("*").eq("id", data.phoneId).eq("team_id", team_id).maybeSingle();
    if (!phone) throw new Error("phone not found");
    const provider = (settings?.carrier_lookup_provider as "twilio" | "numverify" | "telnyx" | null) ?? null;
    const result = await lookupCarrier(phone.phone_number, provider, settings?.carrier_lookup_key);
    await supabase.from("contact_phones").update({
      line_type: result.lineType,
      carrier_name: result.carrierName,
      carrier_lookup_date: new Date().toISOString(),
      is_sms_eligible: result.lineType === "mobile",
    }).eq("id", phone.id);
    return result;
  });

export const batchCarrierLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { data: phones } = await supabase
      .from("contact_phones").select("id").eq("team_id", team_id).is("line_type", null).limit(500);
    let enqueued = 0;
    for (const p of phones ?? []) {
      await supabase.from("job_queue").insert({
        team_id, job_type: "carrier_lookup", payload: { phone_id: p.id },
      });
      enqueued++;
    }
    return { enqueued };
  });
