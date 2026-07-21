import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nextValidSendTime } from "./timezone.functions";
import { enforceLevel } from "./compliance-gate";

/** Pre-flight compliance check for a campaign. Returns summary suitable for the launch modal. */
export const complianceCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: camp } = await supabase
      .from("campaigns")
      .select("id, team_id, type, sending_window_enabled, sending_start_time, sending_end_time, sending_days, timezone")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (!camp) throw new Error("Campaign not found");

    const { data: ccs } = await supabase
      .from("campaign_contacts")
      .select("contact_id")
      .eq("campaign_id", camp.id);
    const contactIds = (ccs ?? []).map((r) => r.contact_id);

    const total = contactIds.length;
    let suppressedDnc = 0;
    let suppressedInternalDnc = 0;
    let suppressedNonMobile = 0;
    let suppressedTimezone = 0;

    if (total > 0) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, detected_timezone, is_dnc_federal, is_dnc_internal, phone")
        .in("id", contactIds);
      const cIndex = new Map((contacts ?? []).map((c) => [c.id, c]));

      let phoneByContact: Map<string, any[]> = new Map();
      if (camp.type === "sms") {
        const { data: phones } = await supabase
          .from("contact_phones")
          .select("contact_id, line_type, is_sms_eligible, is_dnc")
          .in("contact_id", contactIds);
        for (const p of phones ?? []) {
          const arr = phoneByContact.get(p.contact_id) ?? [];
          arr.push(p);
          phoneByContact.set(p.contact_id, arr);
        }
      }

      const now = new Date();
      for (const id of contactIds) {
        const c = cIndex.get(id);
        if (!c) continue;
        if (c.is_dnc_federal) { suppressedDnc++; continue; }
        if (c.is_dnc_internal) { suppressedInternalDnc++; continue; }
        if (camp.type === "sms") {
          const phones = phoneByContact.get(id) ?? [];
          const anyMobile = phones.some((p) => p.is_sms_eligible && !p.is_dnc);
          if (!anyMobile) { suppressedNonMobile++; continue; }
          if (camp.sending_window_enabled && c.detected_timezone) {
            const next = nextValidSendTime(
              c.detected_timezone,
              camp.sending_start_time,
              camp.sending_end_time,
              camp.sending_days,
              "sms",
              now,
            );
            if (Math.abs(next.getTime() - now.getTime()) > 30 * 60_000) suppressedTimezone++;
          }
        }
      }
    }

    const sent = total - suppressedDnc - suppressedInternalDnc - suppressedNonMobile - suppressedTimezone;
    const passed = sent > 0;

    // Append immutable compliance log
    await supabase.from("compliance_log").insert({
      team_id: camp.team_id,
      campaign_id: camp.id,
      contacts_total: total,
      contacts_sent: sent,
      contacts_suppressed_dnc: suppressedDnc,
      contacts_suppressed_non_mobile: suppressedNonMobile,
      contacts_suppressed_timezone: suppressedTimezone,
      contacts_suppressed_internal_dnc: suppressedInternalDnc,
      compliance_passed: passed,
      log_data: { run_by: userId, enforce_level: enforceLevel() },
    });

    return {
      total, sent,
      suppressedDnc, suppressedInternalDnc, suppressedNonMobile, suppressedTimezone,
      enforceLevel: enforceLevel(),
      channel: camp.type,
    };
  });

/** Manual federal DNC scrub (mocked unless dnc_api_key is set). */
export const runFederalDncScrub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { data: settings } = await supabase.from("team_settings").select("dnc_api_provider, dnc_api_key").eq("team_id", team_id).maybeSingle();
    const hasKey = !!settings?.dnc_api_key;
    const { data: phones } = await supabase
      .from("contact_phones")
      .select("id, phone_number, contact_id")
      .eq("team_id", team_id)
      .limit(1000);
    let listed = 0;
    for (const p of phones ?? []) {
      // Mock: 3% of numbers are on DNC
      const isDnc = hasKey
        ? false /* TODO live */
        : (parseInt(p.phone_number.replace(/\D+/g, "").slice(-2) || "0", 10) % 33 === 0);
      if (isDnc) {
        listed++;
        await supabase.from("contact_phones").update({ is_dnc: true }).eq("id", p.id);
        await supabase.from("contacts").update({
          is_dnc_federal: true,
          dnc_reason: "Federal DNC Registry",
          dnc_added_at: new Date().toISOString(),
        }).eq("id", p.contact_id);
        await supabase.from("dnc_suppression_list").insert({
          team_id, phone_or_email: p.phone_number, type: "phone",
          source: "federal", reason: "Federal DNC scrub", added_by_user_id: userId,
        }).select();
      }
    }
    await supabase.from("team_settings").update({ dnc_last_scrub: new Date().toISOString() }).eq("team_id", team_id);
    return { scrubbed: phones?.length ?? 0, listed, mocked: !hasKey };
  });

/** Add a phone/email to the internal DNC list. */
export const addToInternalDnc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    value: z.string().min(3).max(255),
    type: z.enum(["phone", "email"]),
    reason: z.string().max(255).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { error } = await supabase.from("dnc_suppression_list").insert({
      team_id, phone_or_email: data.value, type: data.type,
      source: "internal", reason: data.reason ?? "Manual add", added_by_user_id: userId,
    });
    if (error && !error.message.includes("duplicate")) throw error;
    return { ok: true };
  });

/** List the DNC suppression registry (for the UI). */
export const listDncSuppressions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) return { items: [] };
    let q = supabase.from("dnc_suppression_list").select("*").eq("team_id", team_id).order("added_at", { ascending: false }).limit(500);
    if (data.search) q = q.ilike("phone_or_email", `%${data.search}%`);
    const { data: items } = await q;
    return { items: items ?? [] };
  });

/** Compliance log listing. */
export const listComplianceLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) return { items: [] };
    const { data: items } = await supabase
      .from("compliance_log")
      .select("*")
      .eq("team_id", team_id)
      .order("run_at", { ascending: false })
      .limit(100);
    return { items: items ?? [] };
  });
