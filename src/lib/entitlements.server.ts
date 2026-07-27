// Server-only entitlement enforcement.
//
// team_entitlements records what an account has PAID for. Storing that is not
// the same as enforcing it: a feature is only actually gated if the server
// refuses the action. Hiding a button is presentation, not protection — the
// underlying server function is still callable directly.
//
// So every capability that costs real money calls assertEntitled() before doing
// the expensive thing.

export type FeatureKey =
  | "ai_caller" | "dialer" | "sms" | "email_campaigns" | "discovery" | "social_dm";

const FEATURE_LABELS: Record<FeatureKey, string> = {
  ai_caller: "AI Caller",
  dialer: "Dialer",
  sms: "SMS",
  email_campaigns: "Email Campaigns",
  discovery: "Discovery",
  social_dm: "Social DMs",
};

export interface Entitlements {
  ai_caller: boolean;
  dialer: boolean;
  sms: boolean;
  email_campaigns: boolean;
  discovery: boolean;
  social_dm: boolean;
  daily_email_limit: number;
  daily_sms_limit: number;
  monthly_ai_call_minutes: number;
  overage_allowed: boolean;
}

export async function loadEntitlements(teamId: string): Promise<Entitlements | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("team_entitlements")
    .select("*")
    .eq("team_id", teamId)
    .maybeSingle();
  return (data as Entitlements) ?? null;
}

/**
 * Throw unless the team has paid for `feature`.
 *
 * A missing entitlements row is treated as NOT entitled. The migration
 * backfills every existing team, so absence means something went wrong — and
 * failing open would hand out paid features for free.
 */
export async function assertEntitled(teamId: string, feature: FeatureKey): Promise<Entitlements> {
  const ent = await loadEntitlements(teamId);
  if (!ent || !ent[feature]) {
    throw new Error(
      `${FEATURE_LABELS[feature]} isn't included in your plan. Contact support to add it.`,
    );
  }
  return ent;
}

/**
 * Enforce a daily volume ceiling.
 *
 * When the account has overage enabled the cap is advisory — the send proceeds
 * and the extra is billed — which is what makes "send more than 300 emails" a
 * product rather than an error. Without overage it is a hard stop.
 */
export function checkDailyLimit(
  used: number,
  limit: number,
  ent: Entitlements,
  label: string,
): { allowed: boolean; overage: boolean; reason?: string } {
  if (used < limit) return { allowed: true, overage: false };
  if (ent.overage_allowed) return { allowed: true, overage: true };
  return {
    allowed: false,
    overage: false,
    reason: `Daily ${label} limit of ${limit} reached. Enable overage billing or upgrade to send more.`,
  };
}
