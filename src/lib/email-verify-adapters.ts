/**
 * Email verification adapters: NeverBounce v4 + ZeroBounce v2.
 * Returns "verified" | "unverified" | "invalid" mapped to the
 * existing `email_verify_status` enum used by contact_emails.
 */

export type VerifyResult = {
  provider: "neverbounce" | "zerobounce" | "mx_only" | "none";
  status: "verified" | "unverified" | "invalid";
  raw?: any;
  error?: string;
};

async function neverbounce(email: string, key: string): Promise<VerifyResult> {
  try {
    const res = await fetch("https://api.neverbounce.com/v4/single/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, key }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { provider: "neverbounce", status: "unverified", error: `http ${res.status}` };
    const d: any = await res.json();
    const r = d.result;
    if (r === "valid") return { provider: "neverbounce", status: "verified", raw: d };
    if (r === "invalid" || r === "disposable") return { provider: "neverbounce", status: "invalid", raw: d };
    return { provider: "neverbounce", status: "unverified", raw: d };
  } catch (e: any) {
    return { provider: "neverbounce", status: "unverified", error: e?.message ?? "error" };
  }
}

async function zerobounce(email: string, key: string): Promise<VerifyResult> {
  try {
    const url = `https://api.zerobounce.net/v2/validate?apikey=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`;
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { provider: "zerobounce", status: "unverified", error: `http ${res.status}` };
    const d: any = await res.json();
    const s = d.status;
    if (s === "valid") return { provider: "zerobounce", status: "verified", raw: d };
    if (s === "invalid" || s === "spamtrap" || s === "abuse") return { provider: "zerobounce", status: "invalid", raw: d };
    return { provider: "zerobounce", status: "unverified", raw: d };
  } catch (e: any) {
    return { provider: "zerobounce", status: "unverified", error: e?.message ?? "error" };
  }
}

export async function verifyEmail(
  email: string,
  provider: "neverbounce" | "zerobounce" | "mx_only" | null | undefined,
  key: string | null | undefined,
): Promise<VerifyResult> {
  if (!email || !email.includes("@")) return { provider: "none", status: "invalid", error: "malformed" };
  if (provider === "neverbounce" && key) return neverbounce(email, key);
  if (provider === "zerobounce" && key) return zerobounce(email, key);
  return { provider: "mx_only", status: "unverified" };
}
