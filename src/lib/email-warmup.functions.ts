import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_CONCURRENT = 20;

async function ctx(supabase: any, userId: string) {
  const { data: p } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
  if (!p?.team_id) throw new Error("No team");
  const { data: r } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("team_id", p.team_id).maybeSingle();
  if (!r || !["admin", "manager"].includes(r.role)) throw new Error("Not authorized");
  return { team_id: p.team_id as string };
}

export const listWarmupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!p?.team_id) return { accounts: [] };
    const { data } = await (supabase as any)
      .from("email_accounts")
      .select("id, from_email, provider, warmup_status, warmup_started_at, warmup_completed_at, warmup_day, warmup_current_limit, warmup_target_limit, warmup_flag_reason, warmup_flag_at, warmup_acknowledged_at, daily_limit")
      .eq("team_id", p.team_id)
      .order("created_at");
    return { accounts: data ?? [] };
  });

export const startWarmup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ account_ids: z.array(z.string().uuid()).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id } = await ctx(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count: activeCount } = await (supabaseAdmin as any)
      .from("email_accounts")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team_id)
      .eq("warmup_status", "warming");
    const remaining = MAX_CONCURRENT - (activeCount || 0);
    if (remaining <= 0) throw new Error(`Warmup cap reached (${MAX_CONCURRENT}). Stop one to start another.`);

    const ids = data.account_ids.slice(0, remaining);
    const { data: accounts } = await (supabaseAdmin as any)
      .from("email_accounts").select("id, daily_limit").eq("team_id", team_id).in("id", ids);

    for (const a of accounts ?? []) {
      await (supabaseAdmin as any).from("email_accounts").update({
        warmup_status: "warming",
        warmup_started_at: new Date().toISOString(),
        warmup_completed_at: null,
        warmup_day: 1,
        warmup_current_limit: 5,
        warmup_target_limit: a.daily_limit || 200,
        warmup_flag_reason: null,
        warmup_flag_at: null,
        warmup_acknowledged_at: null,
        warmup_last_tick_at: new Date().toISOString(),
        daily_limit: 5,
      }).eq("id", a.id);
    }
    return { started: ids.length, skipped: data.account_ids.length - ids.length };
  });

export const stopWarmup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id } = await ctx(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("email_accounts").select("warmup_target_limit,daily_limit").eq("id", data.account_id).eq("team_id", team_id).maybeSingle();
    await (supabaseAdmin as any).from("email_accounts").update({
      warmup_status: "idle",
      warmup_day: 0,
      warmup_current_limit: null,
      daily_limit: row?.warmup_target_limit || row?.daily_limit || 200,
    }).eq("id", data.account_id).eq("team_id", team_id);
    return { ok: true };
  });

export const acknowledgeWarmupFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ account_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id } = await ctx(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("email_accounts").update({
      warmup_acknowledged_at: new Date().toISOString(),
    }).eq("id", data.account_id).eq("team_id", team_id);
    return { ok: true };
  });

export const flagWarmup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      account_id: z.string().uuid(),
      status: z.enum(["spammed", "burned", "ready", "idle"]),
      reason: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id } = await ctx(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { warmup_status: data.status };
    if (data.status === "spammed" || data.status === "burned") {
      patch.warmup_flag_reason = data.reason ?? data.status;
      patch.warmup_flag_at = new Date().toISOString();
      patch.warmup_acknowledged_at = null;
      if (data.status === "burned") patch.is_active = false;
    } else {
      patch.warmup_flag_reason = null;
      patch.warmup_flag_at = null;
    }
    await (supabaseAdmin as any).from("email_accounts").update(patch).eq("id", data.account_id).eq("team_id", team_id);
    return { ok: true };
  });
