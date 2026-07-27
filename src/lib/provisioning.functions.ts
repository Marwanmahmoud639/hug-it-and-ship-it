import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURES = [
  "ai_caller", "dialer", "sms", "email_campaigns", "discovery", "social_dm",
] as const;
export type FeatureKey = (typeof FEATURES)[number];

async function assertSuper(supabase: any, userId: string) {
  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (!isSuper) throw new Error("Forbidden");
}

/**
 * Provision an account for a person identified by email.
 *
 * Deliberately does NOT create the auth user: account creation is the user's
 * own action through signup/invite. This attaches plan, credits, seats,
 * branding, and entitlements to whichever team that email already belongs to,
 * so a super admin can set someone up without handling their password.
 */
export const provisionAccountByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      plan: z.enum(["starter", "growth", "agency"]).optional(),
      creditsTotal: z.number().int().min(0).max(10_000_000).optional(),
      seatLimit: z.number().int().min(1).max(10_000).optional(),
      brandColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
      features: z.array(z.enum(FEATURES)).optional(),
      dailyEmailLimit: z.number().int().min(0).max(1_000_000).optional(),
      dailySmsLimit: z.number().int().min(0).max(1_000_000).optional(),
      monthlyAiCallMinutes: z.number().int().min(0).max(1_000_000).optional(),
      overageAllowed: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve the email to a user, then to their team.
    const { data: authUsers, error: authErr } =
      await (supabaseAdmin as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authErr) throw new Error(authErr.message);
    const target = (authUsers?.users ?? []).find(
      (u: any) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );
    if (!target) {
      throw new Error(`No account found for ${data.email}. They need to sign up or be invited first.`);
    }

    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles").select("team_id").eq("id", target.id).maybeSingle();
    if (!profile?.team_id) throw new Error(`${data.email} isn't attached to a team yet.`);
    const teamId = profile.team_id as string;

    const teamPatch: Record<string, unknown> = {};
    if (data.plan !== undefined) teamPatch.plan = data.plan;
    if (data.creditsTotal !== undefined) teamPatch.credits_total = data.creditsTotal;
    if (data.seatLimit !== undefined) teamPatch.seat_limit = data.seatLimit;
    if (data.brandColor !== undefined) teamPatch.brand_color = data.brandColor;
    if (Object.keys(teamPatch).length > 0) {
      const { error } = await (supabaseAdmin as any).from("teams").update(teamPatch).eq("id", teamId);
      if (error) throw new Error(error.message);
    }

    // Entitlements are replaced wholesale when `features` is supplied, so
    // unchecking a box actually revokes it rather than silently leaving it on.
    const entPatch: Record<string, unknown> = { team_id: teamId, updated_by: context.userId, updated_at: new Date().toISOString() };
    if (data.features) {
      for (const f of FEATURES) entPatch[f] = data.features.includes(f);
    }
    if (data.dailyEmailLimit !== undefined) entPatch.daily_email_limit = data.dailyEmailLimit;
    if (data.dailySmsLimit !== undefined) entPatch.daily_sms_limit = data.dailySmsLimit;
    if (data.monthlyAiCallMinutes !== undefined) entPatch.monthly_ai_call_minutes = data.monthlyAiCallMinutes;
    if (data.overageAllowed !== undefined) entPatch.overage_allowed = data.overageAllowed;

    const { error: entErr } = await (supabaseAdmin as any)
      .from("team_entitlements")
      .upsert(entPatch, { onConflict: "team_id" });
    if (entErr) throw new Error(entErr.message);

    return { ok: true, teamId, userId: target.id };
  });

/**
 * Add (or remove) credits on an account by a delta.
 *
 * Separate from provisionAccountByEmail's absolute creditsTotal because
 * topping up is the common operation and doing it by "set the new total"
 * invites arithmetic mistakes. Plan tier is deliberately not involved: custom
 * arrangements are normal, so credits are whatever you decide to grant rather
 * than something a preset dictates.
 */
export const adjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      teamId: z.string().uuid(),
      delta: z.number().int().refine((n) => n !== 0, "Enter a non-zero amount"),
      note: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: team, error: readErr } = await (supabaseAdmin as any)
      .from("teams").select("credits_total").eq("id", data.teamId).maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!team) throw new Error("Team not found");

    // Floor at zero — a negative allocation would read as unlimited in any
    // remaining-credits calculation.
    const next = Math.max(0, Number(team.credits_total ?? 0) + data.delta);
    const { error } = await (supabaseAdmin as any)
      .from("teams").update({ credits_total: next }).eq("id", data.teamId);
    if (error) throw new Error(error.message);

    return { ok: true, creditsTotal: next };
  });

/** Team + entitlement state for one email, to prefill the provisioning form. */
export const lookupAccountByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUsers } =
      await (supabaseAdmin as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
    const target = (authUsers?.users ?? []).find(
      (u: any) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
    );
    if (!target) return { found: false as const };

    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles").select("team_id, name").eq("id", target.id).maybeSingle();
    if (!profile?.team_id) return { found: false as const };

    const [{ data: team }, { data: entitlements }] = await Promise.all([
      (supabaseAdmin as any).from("teams")
        .select("id, name, plan, credits_total, credits_used, seat_limit, brand_color, parent_team_id")
        .eq("id", profile.team_id).maybeSingle(),
      (supabaseAdmin as any).from("team_entitlements")
        .select("*").eq("team_id", profile.team_id).maybeSingle(),
    ]);

    return {
      found: true as const,
      user: { id: target.id, email: target.email, name: profile.name },
      team,
      entitlements,
    };
  });

/** What the current user's team is entitled to — drives paywall UI. */
export const getMyEntitlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!profile?.team_id) return { entitlements: null };
    const { data } = await (supabase as any)
      .from("team_entitlements").select("*").eq("team_id", profile.team_id).maybeSingle();
    return { entitlements: data ?? null };
  });

// ─── Rate card (super admin only) ────────────────────────────────────────────

export const listRateCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { data } = await (context.supabase as any)
      .from("platform_rate_card").select("*").order("unit_key");
    return { rows: data ?? [] };
  });

export const updateRateCardEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      unit_key: z.string().min(1).max(60),
      cost_usd: z.number().min(0).max(1000),
      credits_charged: z.number().min(0).max(100000),
      notes: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("platform_rate_card")
      .update({
        cost_usd: data.cost_usd,
        credits_charged: data.credits_charged,
        notes: data.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("unit_key", data.unit_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Actual spend per unit over a window, joined to the rate card.
 *
 * Uses the api_cost_events ledger rather than the rate card's estimate, so the
 * margin shown is what was really spent, not what we assumed a call would cost.
 */
export const getBillingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const [{ data: card }, { data: events }] = await Promise.all([
      (supabaseAdmin as any).from("platform_rate_card").select("*").order("unit_key"),
      (supabaseAdmin as any).from("api_cost_events")
        .select("provider, operation, units, cost_usd")
        .gte("created_at", since)
        .limit(50000),
    ]);

    // Roll the raw ledger up by operation.
    const byOperation = new Map<string, { units: number; costUsd: number; calls: number }>();
    for (const e of (events ?? []) as any[]) {
      const cur = byOperation.get(e.operation) ?? { units: 0, costUsd: 0, calls: 0 };
      cur.units += Number(e.units ?? 0);
      cur.costUsd += Number(e.cost_usd ?? 0);
      cur.calls += 1;
      byOperation.set(e.operation, cur);
    }

    const actualSpendUsd = Array.from(byOperation.values())
      .reduce((sum, v) => sum + v.costUsd, 0);

    return {
      windowDays: data.days,
      rateCard: card ?? [],
      actualSpendUsd: Number(actualSpendUsd.toFixed(4)),
      byOperation: Array.from(byOperation.entries())
        .map(([operation, v]) => ({
          operation,
          units: v.units,
          calls: v.calls,
          costUsd: Number(v.costUsd.toFixed(4)),
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
    };
  });
