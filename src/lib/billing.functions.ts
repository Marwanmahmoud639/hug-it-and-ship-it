import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Billing view for the signed-in team.
 *
 * Deliberately scoped to the caller's own team and its sub-accounts: an agency
 * sees its children roll up, a sub-account sees only itself. Wholesale vendor
 * pricing from platform_rate_card is NOT exposed here — that is the margin
 * table and stays super-admin only.
 */
export const getMyBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!profile?.team_id) throw new Error("No team");
    const teamId = profile.team_id;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const { data: team } = await (supabase as any)
      .from("teams")
      .select("id, name, plan, credits_total, credits_used, credits_period_start, parent_team_id, brand_color")
      .eq("id", teamId)
      .maybeSingle();

    // Sub-accounts, so an agency can see where its credits are going.
    const { data: children } = await (supabase as any)
      .from("teams")
      .select("id, name, plan, credits_total, credits_used, brand_color")
      .eq("parent_team_id", teamId);

    const { data: entitlements } = await (supabase as any)
      .from("team_entitlements").select("*").eq("team_id", teamId).maybeSingle();

    // What this team actually spent, by operation. RLS on api_cost_events
    // restricts these rows to the caller's own team.
    const { data: events } = await (supabase as any)
      .from("api_cost_events")
      .select("operation, provider, units, cost_usd, ok")
      .gte("created_at", since)
      .limit(20000);

    const byOperation = new Map<string, { units: number; costUsd: number; calls: number }>();
    for (const e of (events ?? []) as any[]) {
      const cur = byOperation.get(e.operation) ?? { units: 0, costUsd: 0, calls: 0 };
      cur.units += Number(e.units ?? 0);
      cur.costUsd += Number(e.cost_usd ?? 0);
      cur.calls += 1;
      byOperation.set(e.operation, cur);
    }
    const consumption = Array.from(byOperation.entries())
      .map(([operation, v]) => ({
        operation,
        units: v.units,
        calls: v.calls,
        costUsd: Number(v.costUsd.toFixed(4)),
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    const totalCostUsd = consumption.reduce((s, c) => s + c.costUsd, 0);
    const creditsTotal = Number(team?.credits_total ?? 0);
    const creditsUsed = Number(team?.credits_used ?? 0);

    return {
      windowDays: data.days,
      team,
      subAccounts: children ?? [],
      entitlements: entitlements ?? null,
      credits: {
        total: creditsTotal,
        used: creditsUsed,
        remaining: Math.max(0, creditsTotal - creditsUsed),
        // Null rather than 0 when nothing is allocated, so the UI can say
        // "no plan" instead of showing a misleading 0% consumed.
        percentUsed: creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : null,
        periodStart: team?.credits_period_start ?? null,
      },
      consumption,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
    };
  });
