import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SwitchableTeam = {
  id: string;
  name: string;
  plan: string;
  parent_team_id: string | null;
  white_label_name: string | null;
  white_label_logo: string | null;
  is_home: boolean;
  is_child: boolean;
  is_super_admin_view: boolean;
};

// List teams the current user can act as: home team + children (if agency admin) + all (if super-admin)
export const listSwitchableTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ teams: SwitchableTeam[]; activeTeamId: string | null; homeTeamId: string | null }> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: sa }, { data: active }] = await Promise.all([
      supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle(),
      supabase.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      supabase.from("active_team_session").select("acting_team_id").eq("user_id", userId).maybeSingle(),
    ]);

    const homeTeamId = (profile?.team_id as string | null) ?? null;
    const isSuperAdmin = !!sa;
    const activeTeamId = ((active as any)?.acting_team_id as string | null) ?? homeTeamId;

    const collected = new Map<string, SwitchableTeam>();

    if (homeTeamId) {
      const { data: home } = await supabase
        .from("teams")
        .select("id, name, plan, parent_team_id, white_label_name, white_label_logo")
        .eq("id", homeTeamId)
        .maybeSingle();
      if (home) {
        collected.set(home.id, {
          ...(home as any),
          is_home: true,
          is_child: false,
          is_super_admin_view: false,
        });
      }

      // children of home team (visible to home-team admins via new RLS policy)
      const { data: children } = await supabase
        .from("teams")
        .select("id, name, plan, parent_team_id, white_label_name, white_label_logo")
        .eq("parent_team_id", homeTeamId)
        .order("name");
      for (const c of children ?? []) {
        collected.set(c.id, {
          ...(c as any),
          is_home: false,
          is_child: true,
          is_super_admin_view: false,
        });
      }
    }

    if (isSuperAdmin) {
      const { data: all } = await supabase
        .from("teams")
        .select("id, name, plan, parent_team_id, white_label_name, white_label_logo")
        .order("name");
      for (const t of all ?? []) {
        if (!collected.has(t.id)) {
          collected.set(t.id, {
            ...(t as any),
            is_home: false,
            is_child: false,
            is_super_admin_view: true,
          });
        }
      }
    }

    return {
      teams: Array.from(collected.values()),
      activeTeamId,
      homeTeamId,
    };
  });

export const switchTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teamId: string }) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: team, error } = await supabase.rpc("switch_team", { _team_id: data.teamId });
    if (error) throw new Error(error.message);
    return { team };
  });

export const clearTeamSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("clear_team_switch");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSubAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string;
    plan?: "starter" | "growth" | "agency";
    adminEmail?: string | null;
    primary?: string | null;
    secondary?: string | null;
    whiteLabelName?: string | null;
    discoveryMonthlyLimit?: number | null;
    contactLimit?: number | null;
  }) =>
    z.object({
      name: z.string().min(1).max(120),
      plan: z.enum(["starter", "growth", "agency"]).default("starter"),
      adminEmail: z.string().trim().toLowerCase().email().max(255).nullable().optional(),
      primary: z.string().max(64).nullable().optional(),
      secondary: z.string().max(64).nullable().optional(),
      whiteLabelName: z.string().max(120).nullable().optional(),
      discoveryMonthlyLimit: z.number().int().min(0).max(10_000_000).nullable().optional(),
      contactLimit: z.number().int().min(0).max(10_000_000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: team, error } = await supabase.rpc("create_sub_account", {
      _name: data.name,
      _plan: data.plan,
    });
    if (error) throw new Error(error.message);
    const teamId = (team as any)?.id as string | undefined;
    if (!teamId) return { team };

    // Apply branding + limits (service role: parent-admin has already been verified by RPC)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, any> = {};
    if (data.primary) patch.white_label_color = data.primary;
    if (data.secondary) patch.white_label_secondary_color = data.secondary;
    if (data.whiteLabelName) patch.white_label_name = data.whiteLabelName;
    if (typeof data.discoveryMonthlyLimit === "number") patch.discovery_monthly_limit = data.discoveryMonthlyLimit;
    if (typeof data.contactLimit === "number") patch.contact_limit = data.contactLimit;
    if (Object.keys(patch).length > 0) {
      await (supabaseAdmin as any).from("teams").update(patch).eq("id", teamId);
    }

    // Assign admin by email — invite as admin. handle_new_user picks up invited_team_id/role
    let invite: { email: string; email_sent: boolean; already_registered: boolean } | null = null;
    if (data.adminEmail) {
      await supabaseAdmin
        .from("team_invites")
        .upsert(
          { team_id: teamId, email: data.adminEmail, role: "admin", invited_by: userId, status: "pending", accepted_at: null },
          { onConflict: "team_id,email" },
        );

      // If they already have an account, upgrade them to admin of the sub-account immediately
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles").select("id").eq("email", data.adminEmail).maybeSingle();
      if (existingProfile?.id) {
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: (existingProfile as any).id, team_id: teamId, role: "admin" },
          { onConflict: "user_id,team_id" },
        );
      }

      const redirectTo = `${process.env.SITE_URL ?? "https://leads.dialingfordollars.co"}/login`;
      const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.adminEmail, {
        redirectTo,
        data: { invited_team_id: teamId, invited_role: "admin", invited_by: userId, team_name: data.name },
      });
      invite = {
        email: data.adminEmail,
        email_sent: !mailErr,
        already_registered: mailErr?.message?.toLowerCase().includes("already") ?? false,
      };
    }

    return { team, invite };
  });


export type AgencyRollup = {
  totalChildren: number;
  totalSeats: number;
  totalSeatLimit: number;
  totalContacts: number;
  totalContactLimit: number;
  activeCampaigns: number;
  children: Array<{
    id: string;
    name: string;
    plan: string;
    seats_used: number;
    seat_limit: number;
    contacts_used: number;
    contact_limit: number;
    active_campaigns: number;
    created_at: string;
  }>;
};

export const getAgencyRollup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgencyRollup> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const parentId = profile?.team_id as string | null;
    if (!parentId) throw new Error("No team");

    const { data: children } = await supabase
      .from("teams")
      .select("id, name, plan, contact_limit, seat_limit, created_at")
      .eq("parent_team_id", parentId)
      .order("created_at", { ascending: false });

    const rows = (children ?? []) as Array<{
      id: string; name: string; plan: string; contact_limit: number; seat_limit: number; created_at: string;
    }>;

    if (rows.length === 0) {
      return {
        totalChildren: 0, totalSeats: 0, totalSeatLimit: 0,
        totalContacts: 0, totalContactLimit: 0, activeCampaigns: 0, children: [],
      };
    }

    const ids = rows.map((r) => r.id);
    // run aggregates per child via parallel counts (small N)
    const enriched = await Promise.all(
      rows.map(async (child) => {
        const [{ count: seats }, { count: contacts }, { count: campaigns }] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("team_id", child.id),
          supabase.from("contacts").select("id", { count: "exact", head: true }).eq("team_id", child.id),
          supabase
            .from("campaigns")
            .select("id", { count: "exact", head: true })
            .eq("team_id", child.id)
            .in("status", ["running", "scheduled"]),
        ]);
        return {
          id: child.id,
          name: child.name,
          plan: child.plan,
          seats_used: seats ?? 0,
          seat_limit: child.seat_limit,
          contacts_used: contacts ?? 0,
          contact_limit: child.contact_limit,
          active_campaigns: campaigns ?? 0,
          created_at: child.created_at,
        };
      }),
    );

    return {
      totalChildren: enriched.length,
      totalSeats: enriched.reduce((s, c) => s + c.seats_used, 0),
      totalSeatLimit: enriched.reduce((s, c) => s + c.seat_limit, 0),
      totalContacts: enriched.reduce((s, c) => s + c.contacts_used, 0),
      totalContactLimit: enriched.reduce((s, c) => s + c.contact_limit, 0),
      activeCampaigns: enriched.reduce((s, c) => s + c.active_campaigns, 0),
      children: enriched,
    };
  });

// ---------- Sub-account branding & admin assignment ----------

async function assertParentAdmin(supabase: any, userId: string, childTeamId: string) {
  const { data: child } = await supabase.from("teams").select("id, parent_team_id").eq("id", childTeamId).maybeSingle();
  if (!child) throw new Error("Team not found");
  const parentId = (child as any).parent_team_id as string | null;
  const { data: sa } = await supabase.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (sa) return;
  if (!parentId) throw new Error("Not a sub-account");
  const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
  if ((prof as any)?.team_id !== parentId) throw new Error("Not allowed");
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("team_id", parentId).maybeSingle();
  if ((role as any)?.role !== "admin") throw new Error("Agency admin only");
}

export const updateSubAccountBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    teamId: string;
    primary?: string | null;
    secondary?: string | null;
    white_label_name?: string | null;
    white_label_logo?: string | null;
  }) =>
    z.object({
      teamId: z.string().uuid(),
      primary: z.string().max(64).nullable().optional(),
      secondary: z.string().max(64).nullable().optional(),
      white_label_name: z.string().max(120).nullable().optional(),
      white_label_logo: z.string().max(2048).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertParentAdmin(supabase, userId, data.teamId);
    const patch: Record<string, any> = {};
    if (data.primary !== undefined) patch.white_label_color = data.primary;
    if (data.secondary !== undefined) patch.white_label_secondary_color = data.secondary;
    if (data.white_label_name !== undefined) patch.white_label_name = data.white_label_name;
    if (data.white_label_logo !== undefined) patch.white_label_logo = data.white_label_logo;
    const { error } = await (supabase as any).from("teams").update(patch).eq("id", data.teamId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSubAccountMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teamId: string }) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertParentAdmin(supabase, userId, data.teamId);
    const { data: members } = await supabase
      .from("profiles").select("id, email, name").eq("team_id", data.teamId).order("name");
    const ids = (members ?? []).map((m: any) => m.id);
    let roleMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: roles } = await supabase
        .from("user_roles").select("user_id, role").eq("team_id", data.teamId).in("user_id", ids);
      roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
    }
    return {
      members: (members ?? []).map((m: any) => ({ ...m, role: roleMap.get(m.id) ?? null })),
    };
  });

export const assignSubAccountAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { teamId: string; userId: string }) =>
    z.object({ teamId: z.string().uuid(), userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertParentAdmin(supabase, userId, data.teamId);
    // ensure target is a member of the sub-account
    const { data: target } = await supabase
      .from("profiles").select("id, team_id").eq("id", data.userId).maybeSingle();
    if (!target || (target as any).team_id !== data.teamId) throw new Error("User is not a member of this sub-account");
    // upsert role=admin
    const { error } = await (supabase as any)
      .from("user_roles")
      .upsert({ user_id: data.userId, team_id: data.teamId, role: "admin" }, { onConflict: "user_id,team_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
