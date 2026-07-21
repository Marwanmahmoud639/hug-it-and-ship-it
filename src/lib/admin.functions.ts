import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw error;
  if (!data) throw new Error("Forbidden");
}

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
    const sinceMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [signups7d, paidMonth, pending, activeSubs, plans] = await Promise.all([
      supabaseAdmin.from("signups").select("id", { count: "exact", head: true }).gte("created_at", since7d),
      supabaseAdmin.from("payments").select("amount", { count: "exact" }).eq("status", "succeeded").gte("created_at", sinceMonth),
      supabaseAdmin.from("signups").select("id", { count: "exact", head: true }).eq("status", "paid"),
      supabaseAdmin.from("subscriptions").select("plan_slug").eq("status", "active"),
      supabaseAdmin.from("plans").select("slug, price_monthly"),
    ]);
    const priceMap = new Map((plans.data ?? []).map((p: any) => [p.slug, Number(p.price_monthly)]));
    const mrr = (activeSubs.data ?? []).reduce((s: number, r: any) => s + (priceMap.get(r.plan_slug) ?? 0), 0);
    const paidThisMonth = (paidMonth.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    return {
      signups7d: signups7d.count ?? 0,
      paidThisMonth,
      pending: pending.count ?? 0,
      activeSubsCount: (activeSubs.data ?? []).length,
      mrr,
    };
  });

export const listSignups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("signups").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { signups: rows ?? [] };
  });

export const listPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("id, buyer_email, amount, currency, status, whop_plan_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { payments: data ?? [] };
  });

export const listSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, plan_slug, seats, status, current_period_end, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { subscriptions: data ?? [] };
  });

export const provisionAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ signupId: z.string().uuid(), seats: z.number().int().min(1).max(50).default(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signup, error: sErr } = await supabaseAdmin
      .from("signups")
      .select("id, user_id, email, selected_plan_slug")
      .eq("id", data.signupId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!signup) throw new Error("Signup not found");
    if (!signup.user_id) throw new Error("Signup has no user account");

    // Upsert subscription as active
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: signup.user_id,
        plan_slug: signup.selected_plan_slug,
        seats: data.seats,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plan_slug" as any },
    );
    await supabaseAdmin.from("signups").update({ status: "provisioned" }).eq("id", signup.id);
    return { ok: true };
  });

export const createManualUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      fullName: z.string().trim().min(1).max(200),
      planSlug: z.string().trim().min(2).max(40),
      seats: z.number().int().min(1).max(50).default(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { name: data.fullName, plan: data.planSlug === "agency" ? "agency" : data.planSlug === "growth" ? "growth" : "starter" },
    });
    if (invErr) throw invErr;
    const newUserId = invited.user?.id;
    if (!newUserId) throw new Error("Invite failed");
    await supabaseAdmin.from("signups").insert({
      user_id: newUserId,
      email: data.email.toLowerCase(),
      full_name: data.fullName,
      selected_plan_slug: data.planSlug,
      status: "provisioned",
    });
    await supabaseAdmin.from("subscriptions").insert({
      user_id: newUserId,
      plan_slug: data.planSlug,
      seats: data.seats,
      status: "active",
    });
    return { ok: true, userId: newUserId };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("id", data.subscriptionId);
    return { ok: true };
  });

export const updateSignupNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ signupId: z.string().uuid(), notes: z.string().max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("signups").update({ notes: data.notes }).eq("id", data.signupId);
    return { ok: true };
  });

export const isStaffCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    return { isStaff: !!data };
  });
