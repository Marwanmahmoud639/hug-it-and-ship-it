/**
 * Carrier / line-type lookup adapters — LIVE.
 * Returns "unknown" with isMock:false when no key configured.
 */

export type LineType = "mobile" | "landline" | "voip" | "toll_free" | "unknown";

export type CarrierResult = {
  lineType: LineType;
  carrierName: string;
  isMock: false;
  provider: "twilio" | "numverify" | "telnyx" | "none";
  error?: string;
};

function normalize(t?: string | null): LineType {
  const s = (t ?? "").toLowerCase();
  if (s === "mobile" || s.includes("cell") || s.includes("wireless")) return "mobile";
  if (s === "landline" || s === "fixed_line" || s === "fixed") return "landline";
  if (s === "voip" || s === "nonfixedvoip" || s === "fixed-voip" || s === "non-fixed-voip") return "voip";
  if (s.includes("toll")) return "toll_free";
  return "unknown";
}

const TIMEOUT_MS = 8000;

async function safeFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return null;
  }
}

// Twilio Lookup v2. Twilio uses Basic auth: AccountSid:AuthToken.
// AuthToken may be passed via apiKey, OR sourced from env (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).
async function callTwilio(phone: string, apiKey?: string | null): Promise<CarrierResult> {
  const sid = (typeof process !== "undefined" ? process.env?.TWILIO_ACCOUNT_SID : undefined) ?? "";
  const token = apiKey ?? (typeof process !== "undefined" ? process.env?.TWILIO_AUTH_TOKEN : undefined) ?? "";
  if (!sid || !token) {
    return { provider: "twilio", lineType: "unknown", carrierName: "Unknown", isMock: false, error: "twilio credentials missing" };
  }
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`;
  const auth = btoa(`${sid}:${token}`);
  const res = await safeFetch(url, { method: "GET", headers: { Authorization: `Basic ${auth}` } });
  if (!res) return { provider: "twilio", lineType: "unknown", carrierName: "Unknown", isMock: false, error: "timeout" };
  if (!res.ok) return { provider: "twilio", lineType: "unknown", carrierName: "Unknown", isMock: false, error: `http ${res.status}` };
  try {
    const d: any = await res.json();
    const lti = d.line_type_intelligence ?? {};
    return {
      provider: "twilio",
      lineType: normalize(lti.type),
      carrierName: lti.carrier_name ?? "Unknown",
      isMock: false,
    };
  } catch (e: any) {
    return { provider: "twilio", lineType: "unknown", carrierName: "Unknown", isMock: false, error: e?.message };
  }
}

async function callNumverify(phone: string, apiKey: string): Promise<CarrierResult> {
  const url = `http://apilayer.net/api/validate?access_key=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(phone)}&format=1`;
  const res = await safeFetch(url, { method: "GET" });
  if (!res) return { provider: "numverify", lineType: "unknown", carrierName: "Unknown", isMock: false, error: "timeout" };
  if (!res.ok) return { provider: "numverify", lineType: "unknown", carrierName: "Unknown", isMock: false, error: `http ${res.status}` };
  try {
    const d: any = await res.json();
    return {
      provider: "numverify",
      lineType: normalize(d.line_type),
      carrierName: d.carrier ?? "Unknown",
      isMock: false,
    };
  } catch (e: any) {
    return { provider: "numverify", lineType: "unknown", carrierName: "Unknown", isMock: false, error: e?.message };
  }
}

export async function lookupCarrier(
  phone: string,
  provider: "twilio" | "numverify" | "telnyx" | null | undefined,
  apiKey: string | null | undefined,
): Promise<CarrierResult> {
  if (!provider) return { provider: "none", lineType: "unknown", carrierName: "Unknown", isMock: false, error: "no provider" };
  if (provider === "twilio") return callTwilio(phone, apiKey);
  if (provider === "numverify") {
    if (!apiKey) return { provider: "numverify", lineType: "unknown", carrierName: "Unknown", isMock: false, error: "no key" };
    return callNumverify(phone, apiKey);
  }
  // Telnyx — not yet wired
  return { provider: "telnyx", lineType: "unknown", carrierName: "Unknown", isMock: false, error: "telnyx adapter not implemented" };
}
