// Server-only Whop helpers. Never imported at module scope from client-reachable files.
import { createHmac, timingSafeEqual } from "crypto";

const WHOP_API = "https://api.whop.com/api/v2";

export function whopHeaders() {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new Error("WHOP_API_KEY not configured");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function fetchWhopMembership(membershipId: string) {
  const res = await fetch(`${WHOP_API}/memberships/${membershipId}`, { headers: whopHeaders() });
  if (!res.ok) throw new Error(`Whop membership ${membershipId}: ${res.status}`);
  return res.json();
}

export function verifyWhopSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  // Whop sends "sha256=<hex>" or just hex; handle both.
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
