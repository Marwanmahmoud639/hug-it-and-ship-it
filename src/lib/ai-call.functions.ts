import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Area-code -> IANA timezone, for the TCPA calling-window check.
 *
 * The window applies in the CALLED party's local time, and the only signal we
 * have before connecting is the number itself. This covers the US/Canada NANP
 * and is deliberately conservative: an unmapped area code is treated as
 * unknown, and unknown blocks the call rather than assuming the caller's zone.
 */
const AREA_CODE_TZ: Record<string, string> = {
  // Eastern
  "201": "America/New_York", "202": "America/New_York", "203": "America/New_York",
  "212": "America/New_York", "215": "America/New_York", "216": "America/New_York",
  "234": "America/New_York", "239": "America/New_York", "240": "America/New_York",
  "248": "America/New_York", "301": "America/New_York", "302": "America/New_York",
  "305": "America/New_York", "313": "America/New_York", "315": "America/New_York",
  "321": "America/New_York", "330": "America/New_York", "336": "America/New_York",
  "347": "America/New_York", "352": "America/New_York", "386": "America/New_York",
  "404": "America/New_York", "407": "America/New_York", "410": "America/New_York",
  "412": "America/New_York", "413": "America/New_York", "419": "America/New_York",
  "440": "America/New_York", "443": "America/New_York", "470": "America/New_York",
  "478": "America/New_York", "484": "America/New_York", "516": "America/New_York",
  "517": "America/New_York", "518": "America/New_York", "561": "America/New_York",
  "570": "America/New_York", "571": "America/New_York", "585": "America/New_York",
  "586": "America/New_York", "603": "America/New_York", "607": "America/New_York",
  "610": "America/New_York", "614": "America/New_York", "616": "America/New_York",
  "617": "America/New_York", "631": "America/New_York", "646": "America/New_York",
  "678": "America/New_York", "703": "America/New_York", "704": "America/New_York",
  "716": "America/New_York", "717": "America/New_York", "718": "America/New_York",
  "724": "America/New_York", "727": "America/New_York", "732": "America/New_York",
  "734": "America/New_York", "740": "America/New_York", "754": "America/New_York",
  "757": "America/New_York", "770": "America/New_York", "772": "America/New_York",
  "774": "America/New_York", "781": "America/New_York", "786": "America/New_York",
  "802": "America/New_York", "803": "America/New_York", "804": "America/New_York",
  "810": "America/New_York", "813": "America/New_York", "814": "America/New_York",
  "828": "America/New_York", "843": "America/New_York", "845": "America/New_York",
  "856": "America/New_York", "857": "America/New_York", "859": "America/New_York",
  "860": "America/New_York", "862": "America/New_York", "864": "America/New_York",
  "878": "America/New_York", "904": "America/New_York", "908": "America/New_York",
  "910": "America/New_York", "912": "America/New_York", "914": "America/New_York",
  "917": "America/New_York", "919": "America/New_York", "929": "America/New_York",
  "941": "America/New_York", "947": "America/New_York", "954": "America/New_York",
  "959": "America/New_York", "980": "America/New_York", "984": "America/New_York",
  // Central
  "205": "America/Chicago", "210": "America/Chicago", "214": "America/Chicago",
  "217": "America/Chicago", "218": "America/Chicago", "224": "America/Chicago",
  "225": "America/Chicago", "228": "America/Chicago", "251": "America/Chicago",
  "256": "America/Chicago", "262": "America/Chicago", "270": "America/Chicago",
  "281": "America/Chicago", "309": "America/Chicago", "312": "America/Chicago",
  "314": "America/Chicago", "316": "America/Chicago", "318": "America/Chicago",
  "319": "America/Chicago", "320": "America/Chicago", "331": "America/Chicago",
  "334": "America/Chicago", "337": "America/Chicago", "402": "America/Chicago",
  "405": "America/Chicago", "409": "America/Chicago", "414": "America/Chicago",
  "417": "America/Chicago", "430": "America/Chicago", "432": "America/Chicago",
  "469": "America/Chicago", "479": "America/Chicago", "501": "America/Chicago",
  "504": "America/Chicago", "507": "America/Chicago", "512": "America/Chicago",
  "515": "America/Chicago", "563": "America/Chicago", "573": "America/Chicago",
  "580": "America/Chicago", "601": "America/Chicago", "605": "America/Chicago",
  "608": "America/Chicago", "612": "America/Chicago", "615": "America/Chicago",
  "618": "America/Chicago", "620": "America/Chicago", "630": "America/Chicago",
  "636": "America/Chicago", "651": "America/Chicago", "662": "America/Chicago",
  "682": "America/Chicago", "708": "America/Chicago", "712": "America/Chicago",
  "713": "America/Chicago", "715": "America/Chicago", "731": "America/Chicago",
  "737": "America/Chicago", "763": "America/Chicago", "769": "America/Chicago",
  "773": "America/Chicago", "779": "America/Chicago", "785": "America/Chicago",
  "806": "America/Chicago", "815": "America/Chicago", "816": "America/Chicago",
  "817": "America/Chicago", "830": "America/Chicago", "832": "America/Chicago",
  "847": "America/Chicago", "870": "America/Chicago", "901": "America/Chicago",
  "903": "America/Chicago", "913": "America/Chicago", "915": "America/Chicago",
  "918": "America/Chicago", "920": "America/Chicago", "931": "America/Chicago",
  "936": "America/Chicago", "940": "America/Chicago", "952": "America/Chicago",
  "956": "America/Chicago", "972": "America/Chicago", "979": "America/Chicago",
  // Mountain
  "303": "America/Denver", "307": "America/Denver", "308": "America/Denver",
  "385": "America/Denver", "406": "America/Denver", "435": "America/Denver",
  "505": "America/Denver", "575": "America/Denver", "719": "America/Denver",
  "720": "America/Denver", "801": "America/Denver", "970": "America/Denver",
  // Arizona (no DST)
  "480": "America/Phoenix", "520": "America/Phoenix", "602": "America/Phoenix",
  "623": "America/Phoenix", "928": "America/Phoenix",
  // Pacific
  "206": "America/Los_Angeles", "209": "America/Los_Angeles", "213": "America/Los_Angeles",
  "253": "America/Los_Angeles", "310": "America/Los_Angeles", "323": "America/Los_Angeles",
  "341": "America/Los_Angeles", "360": "America/Los_Angeles", "408": "America/Los_Angeles",
  "415": "America/Los_Angeles", "425": "America/Los_Angeles", "442": "America/Los_Angeles",
  "503": "America/Los_Angeles", "509": "America/Los_Angeles", "510": "America/Los_Angeles",
  "530": "America/Los_Angeles", "541": "America/Los_Angeles", "559": "America/Los_Angeles",
  "562": "America/Los_Angeles", "619": "America/Los_Angeles", "626": "America/Los_Angeles",
  "650": "America/Los_Angeles", "657": "America/Los_Angeles", "661": "America/Los_Angeles",
  "669": "America/Los_Angeles", "702": "America/Los_Angeles", "707": "America/Los_Angeles",
  "714": "America/Los_Angeles", "725": "America/Los_Angeles", "747": "America/Los_Angeles",
  "760": "America/Los_Angeles", "775": "America/Los_Angeles", "805": "America/Los_Angeles",
  "818": "America/Los_Angeles", "831": "America/Los_Angeles", "858": "America/Los_Angeles",
  "909": "America/Los_Angeles", "916": "America/Los_Angeles", "925": "America/Los_Angeles",
  "949": "America/Los_Angeles", "951": "America/Los_Angeles", "971": "America/Los_Angeles",
  // Alaska / Hawaii
  "907": "America/Anchorage", "808": "Pacific/Honolulu",
};

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** NANP area code, tolerating a leading country code. */
function areaCodeOf(phone: string): string | null {
  const d = digitsOnly(phone);
  const national = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return national.length === 10 ? national.slice(0, 3) : null;
}

function localHourIn(timezone: string): { hour: number; time: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { hour, time: `${String(hour).padStart(2, "0")}:${minute}:00` };
}

export type CallGateResult =
  | { allowed: true; timezone: string; localTime: string }
  | { allowed: false; reason: string; timezone?: string; localTime?: string };

/**
 * Pre-flight compliance check. Exposed on its own so the UI can show why a
 * number can't be dialled before anyone clicks call.
 */
export const checkCallCompliance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ phone: z.string().min(7).max(25) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CallGateResult> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!profile?.team_id) return { allowed: false, reason: "No team" };
    const teamId = profile.team_id;

    const { data: settings } = await (supabase as any)
      .from("team_settings")
      .select("ai_calls_enabled, ai_call_window_start_hour, ai_call_window_end_hour")
      .eq("team_id", teamId)
      .maybeSingle();

    if (!settings?.ai_calls_enabled) {
      return { allowed: false, reason: "AI calling is turned off for this team. Enable it in Settings after confirming your consent basis." };
    }

    // Suppression list — checked live, never from a cached import.
    const { data: suppressed } = await (supabase as any)
      .rpc("is_number_suppressed", { _team_id: teamId, _phone: data.phone });
    if (suppressed === true) {
      return { allowed: false, reason: "This number is on your suppression list." };
    }

    const area = areaCodeOf(data.phone);
    const timezone = area ? AREA_CODE_TZ[area] : undefined;
    if (!timezone) {
      // Fail closed: without a timezone we cannot prove the call is inside the
      // legal window, and guessing is what generates violations.
      return {
        allowed: false,
        reason: "Could not determine the recipient's timezone from this number, so the calling window can't be verified.",
      };
    }

    const { hour, time } = localHourIn(timezone);
    const start = settings.ai_call_window_start_hour ?? 9;
    const end = settings.ai_call_window_end_hour ?? 20;
    if (hour < start || hour >= end) {
      return {
        allowed: false,
        timezone,
        localTime: time,
        reason: `It's ${time} for this contact (${timezone}). Calls are only allowed between ${start}:00 and ${end}:00 local time.`,
      };
    }

    return { allowed: true, timezone, localTime: time };
  });

/**
 * Place an autonomous AI call.
 *
 * Runs the same compliance gate as checkCallCompliance — deliberately re-run
 * here rather than trusting a result the client passed back, since time may
 * have moved past the window and a client-supplied verdict is forgeable.
 */
export const startAiCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      phone: z.string().min(7).max(25),
      contactId: z.string().uuid().optional(),
      agentId: z.string().uuid().optional(),
      consentBasis: z.enum(["prior_express_written", "existing_business_relationship"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!profile?.team_id) throw new Error("No team");
    const teamId = profile.team_id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: team } = await (supabaseAdmin as any)
      .from("teams").select("name").eq("id", teamId).maybeSingle();
    const { data: settings } = await (supabaseAdmin as any)
      .from("team_settings")
      .select("ai_calls_enabled, ai_call_window_start_hour, ai_call_window_end_hour, ai_call_disclosure")
      .eq("team_id", teamId)
      .maybeSingle();

    // Record the attempt before any gate can reject it, so a blocked call
    // leaves evidence it was stopped rather than vanishing.
    const writeSession = async (fields: Record<string, unknown>) => {
      const { data: row } = await (supabaseAdmin as any)
        .from("ai_call_sessions")
        .insert({
          team_id: teamId,
          started_by: userId,
          contact_id: data.contactId ?? null,
          agent_id: data.agentId ?? null,
          to_number: data.phone,
          from_number: "",
          consent_basis: data.consentBasis,
          dnc_checked_at: new Date().toISOString(),
          ...fields,
        })
        .select("id")
        .single();
      return row?.id as string | undefined;
    };

    const reject = async (reason: string, extra: Record<string, unknown> = {}) => {
      await writeSession({ status: "blocked", block_reason: reason, ...extra });
      throw new Error(reason);
    };

    // Commercial gate first: has this account actually paid for AI calling?
    // Checked server-side because hiding the button doesn't stop a direct call
    // to this function.
    const { assertEntitled } = await import("@/lib/entitlements.server");
    try {
      await assertEntitled(teamId, "ai_caller");
    } catch (e) {
      await reject(String(e instanceof Error ? e.message : e));
    }

    if (!settings?.ai_calls_enabled) {
      await reject("AI calling is turned off for this team. Enable it in Settings after confirming your consent basis.");
    }

    const { data: suppressed } = await (supabaseAdmin as any)
      .rpc("is_number_suppressed", { _team_id: teamId, _phone: data.phone });
    if (suppressed === true) await reject("This number is on your suppression list.");

    const area = areaCodeOf(data.phone);
    const timezone = area ? AREA_CODE_TZ[area] : undefined;
    if (!timezone) {
      await reject("Could not determine the recipient's timezone from this number, so the calling window can't be verified.");
    }

    const { hour, time } = localHourIn(timezone!);
    const start = settings.ai_call_window_start_hour ?? 9;
    const end = settings.ai_call_window_end_hour ?? 20;
    if (hour < start || hour >= end) {
      await reject(
        `It's ${time} for this contact (${timezone}). Calls are only allowed between ${start}:00 and ${end}:00 local time.`,
        { called_party_timezone: timezone, local_call_time: time },
      );
    }

    // Dial through whatever carrier the team configured.
    const { loadActiveProviderForTeam } = await import("@/lib/dialer/registry");
    const active = await loadActiveProviderForTeam(teamId);
    const fromNumber = active?.row.from_number ?? process.env.TWILIO_CALLER_ID ?? "";
    const accountSid = (active?.row.credentials as any)?.account_sid ?? process.env.TWILIO_ACCOUNT_SID;
    const authToken = (active?.row.credentials as any)?.auth_token ?? process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken || !fromNumber) {
      await reject("No dialer provider configured. Add one in Settings → Dialer Providers.");
    }

    const disclosure = (settings.ai_call_disclosure ?? "")
      .replace(/\{company\}/gi, team?.name ?? "our team");

    const sessionId = await writeSession({
      status: "dialing",
      from_number: fromNumber,
      disclosure_text: disclosure,
      called_party_timezone: timezone,
      local_call_time: time,
    });
    if (!sessionId) throw new Error("Could not create call session");

    // Twilio fetches this TwiML on answer; it points at the media bridge.
    const origin = process.env.PUBLIC_APP_ORIGIN ?? "";
    const twimlUrl = `${origin}/api/public/twilio/ai-stream?session=${sessionId}`;

    const body = new URLSearchParams({
      To: data.phone,
      From: fromNumber,
      Url: twimlUrl,
      // Twilio gives up if nobody answers; 30s is roughly six rings.
      Timeout: "30",
      MachineDetection: "Enable",
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    const json = await res.json();
    if (!res.ok) {
      const msg = json?.message ?? "Carrier rejected the call";
      await (supabaseAdmin as any)
        .from("ai_call_sessions")
        .update({ status: "failed", block_reason: msg, ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      throw new Error(msg);
    }

    await (supabaseAdmin as any)
      .from("ai_call_sessions")
      .update({ provider_call_sid: json.sid })
      .eq("id", sessionId);

    return { sessionId, callSid: json.sid as string, timezone, localTime: time };
  });

export const listAiCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!profile?.team_id) return { calls: [] };
    const { data } = await (supabase as any)
      .from("ai_call_sessions")
      .select("id, to_number, status, block_reason, outcome, duration_seconds, called_party_timezone, created_at")
      .eq("team_id", profile.team_id)
      .order("created_at", { ascending: false })
      .limit(50);
    return { calls: data ?? [] };
  });
