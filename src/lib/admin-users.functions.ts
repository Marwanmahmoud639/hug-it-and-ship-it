import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "manager", "agent"]),
  market: z.string().trim().max(200).optional(),
});

export const inviteUserWithMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isSuper) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: caller } = await supabaseAdmin.from("profiles").select("team_id").eq("id", context.userId).maybeSingle();
    const teamId = caller?.team_id;
    if (!teamId) throw new Error("Super admin has no team");

    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { invited_team_id: teamId, invited_role: data.role, target_market: data.market ?? null },
    });
    if (inviteErr) throw inviteErr;

    await supabaseAdmin.from("team_invites").insert({
      team_id: teamId,
      email: data.email.toLowerCase(),
      role: data.role,
      status: "pending",
    }).select().maybeSingle();

    return { ok: true, userId: invited.user?.id ?? null };
  });

export const listManagedUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isSuper) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, team_id, created_at, teams(name, plan)")
      .order("created_at", { ascending: false })
      .limit(200);
    const emails = (profiles ?? []).map((p: any) => (p.email ?? "").toLowerCase()).filter(Boolean);
    const { data: purchases } = emails.length
      ? await supabaseAdmin.from("whop_purchases").select("email, tier, status, created_at").in("email", emails)
      : { data: [] as any[] };
    const purchaseMap = new Map<string, any>();
    for (const p of purchases ?? []) purchaseMap.set(p.email.toLowerCase(), p);
    return {
      users: (profiles ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        team: p.teams?.name ?? null,
        plan: p.teams?.plan ?? null,
        created_at: p.created_at,
        whop: purchaseMap.get((p.email ?? "").toLowerCase()) ?? null,
      })),
    };
  });

async function assertSuper(supabase: any, userId: string) {
  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (!isSuper) throw new Error("Forbidden");
}

export const listAllUsersForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, name, team_id, created_at, teams(name, plan, parent_team_id)")
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = (profiles ?? []).map((p: any) => p.id);
    let roleMap = new Map<string, string>();
    if (ids.length) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles").select("user_id, team_id, role").in("user_id", ids);
      for (const r of roles ?? []) {
        const p: any = (profiles ?? []).find((x: any) => x.id === r.user_id);
        if (p && p.team_id === r.team_id) roleMap.set(r.user_id, r.role);
      }
    }
    return {
      users: (profiles ?? []).map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        team_id: p.team_id,
        team_name: p.teams?.name ?? null,
        team_plan: p.teams?.plan ?? null,
        is_sub_account: !!p.teams?.parent_team_id,
        role: roleMap.get(p.id) ?? null,
        created_at: p.created_at,
      })),
    };
  });

export const listAllTeamsForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("teams")
      .select("id, name, plan, parent_team_id, seat_limit, contact_limit")
      .order("name");
    return { teams: data ?? [] };
  });

export const reassignUserToTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    userId: z.string().uuid(),
    teamId: z.string().uuid(),
    role: z.enum(["admin", "manager", "agent"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: pErr } = await supabaseAdmin.from("profiles").update({ team_id: data.teamId }).eq("id", data.userId);
    if (pErr) throw new Error(pErr.message);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, team_id: data.teamId, role: data.role }, { onConflict: "user_id,team_id" });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

export const removeUserCompletely = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Cannot remove yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteUserToTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().trim().email().max(255),
    teamId: z.string().uuid(),
    role: z.enum(["admin", "manager", "agent"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { invited_team_id: data.teamId, invited_role: data.role },
    });
    if (inviteErr) throw inviteErr;
    await supabaseAdmin.from("team_invites").insert({
      team_id: data.teamId,
      email: data.email.toLowerCase(),
      role: data.role,
      status: "pending",
    });
    await supabaseAdmin.from("approved_emails").insert({ email: data.email.toLowerCase(), approved_by: context.userId }).select();
    return { ok: true, userId: invited.user?.id ?? null };
  });

export const setTeamLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    teamId: z.string().uuid(),
    seat_limit: z.number().int().min(1).max(10000).optional(),
    contact_limit: z.number().int().min(1).max(100000000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, any> = {};
    if (data.seat_limit !== undefined) patch.seat_limit = data.seat_limit;
    if (data.contact_limit !== undefined) patch.contact_limit = data.contact_limit;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await (supabaseAdmin as any).from("teams").update(patch).eq("id", data.teamId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
