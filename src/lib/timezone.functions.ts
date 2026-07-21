import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { timezoneFromPhone, timezoneFromState } from "./area-code-timezone";
import { TCPA_HARD_END_HOUR, TCPA_HARD_START_HOUR } from "./compliance-gate";

/** Detect & persist a contact's timezone (idempotent). */
export const detectContactTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: c } = await supabase
      .from("contacts")
      .select("id, phone, state, city")
      .eq("id", data.contactId)
      .maybeSingle();
    if (!c) return { ok: false, reason: "not_found" };

    const { data: phones } = await supabase
      .from("contact_phones")
      .select("phone_number")
      .eq("contact_id", c.id)
      .limit(5);
    let tz: string | null = null;
    let source: "area_code" | "address" | "city" | "manual" | null = null;
    let confidence: "high" | "medium" | "low" = "low";

    for (const p of phones ?? []) {
      const z = timezoneFromPhone(p.phone_number);
      if (z) { tz = z; source = "area_code"; confidence = "high"; break; }
    }
    if (!tz && c.phone) {
      const z = timezoneFromPhone(c.phone);
      if (z) { tz = z; source = "area_code"; confidence = "high"; }
    }
    if (!tz) {
      const z = timezoneFromState(c.state);
      if (z) { tz = z; source = "address"; confidence = "medium"; }
    }
    if (!tz) {
      tz = "America/Chicago";
      source = "city";
      confidence = "low";
    }
    await supabase.from("contacts").update({
      detected_timezone: tz,
      timezone_source: source,
      timezone_confidence: confidence,
    }).eq("id", c.id);
    return { ok: true, tz, source, confidence };
  });

/** Pure helper: next valid SMS send time in the recipient's timezone. */
export function nextValidSendTime(
  recipientTz: string,
  windowStart: string | null, // "HH:mm"
  windowEnd: string | null,
  sendingDays: string[] | null,
  channel: "sms" | "email" | "other",
  now: Date = new Date(),
): Date {
  const hardStart = TCPA_HARD_START_HOUR;
  const hardEnd = TCPA_HARD_END_HOUR;
  // Compute local hours for the recipient via Intl
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: recipientTz, hour: "numeric", minute: "numeric", hour12: false, weekday: "short",
  }).formatToParts(now);
  const hourStr = local.find((p) => p.type === "hour")?.value ?? "0";
  const dayStr = (local.find((p) => p.type === "weekday")?.value ?? "Mon").slice(0, 3);
  const hour = parseInt(hourStr, 10);

  let startH = hardStart;
  let endH = hardEnd;
  if (channel !== "sms" && windowStart && windowEnd) {
    startH = Math.max(parseInt(windowStart.split(":")[0], 10), 0);
    endH = Math.min(parseInt(windowEnd.split(":")[0], 10), 24);
  } else if (channel === "sms" && windowStart && windowEnd) {
    startH = Math.max(parseInt(windowStart.split(":")[0], 10), hardStart);
    endH = Math.min(parseInt(windowEnd.split(":")[0], 10), hardEnd);
  }

  const okDay = !sendingDays || sendingDays.length === 0 || sendingDays.includes(dayStr);
  if (okDay && hour >= startH && hour < endH) return now;

  // Otherwise: schedule next start hour (rough: add (24-hour+startH) hours)
  const delta = (24 - hour + startH) * 3600_000;
  return new Date(now.getTime() + delta);
}
