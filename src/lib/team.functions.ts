import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLE = z.enum(["admin", "manager", "agent"]);

async function getCtx(supabase: any, userId: string) {
  const { data: p } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
  if (!p?.team_id) throw new Error("No team");
  const team_id = p.team_id as string;
  const { data: r } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("team_id", team_id)
    .maybeSingle();
  return { team_id, role: (r?.role ?? null) as "admin" | "manager" | "agent" | null };
}

function requireAdmin(role: string | null) {
  if (role !== "admin") throw new Error("Only team admins can perform this action");
}

export const listTeamMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { team_id } = await getCtx(supabase, userId);

    const [{ data: profs }, { data: roles }, { data: invites }, { data: team }] = await Promise.all([
      supabase.from("profiles").select("id, email, name, avatar_url").eq("team_id", team_id),
      supabase.from("user_roles").select("user_id, role").eq("team_id", team_id),
      supabase
        .from("team_invites")
        .select("id, email, role, status, created_at")
        .eq("team_id", team_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("teams").select("seat_limit, owner_id").eq("id", team_id).maybeSingle(),
    ]);

    const roleMap = new Map<string, string>();
    for (const r of roles ?? []) roleMap.set(r.user_id, r.role);

    const members = (profs ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      name: p.name,
      avatar_url: p.avatar_url,
      role: roleMap.get(p.id) ?? "agent",
      is_owner: team?.owner_id === p.id,
    }));

    return {
      members,
      invites: invites ?? [],
      seat_limit: team?.seat_limit ?? 1,
      owner_id: team?.owner_id ?? null,
    };
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        role: ROLE,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id, role } = await getCtx(supabase, userId);
    requireAdmin(role);

    // Seat limit check
    const [{ data: team }, { count: memberCount }, { count: pendingCount }] = await Promise.all([
      supabase.from("teams").select("seat_limit, name").eq("id", team_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("team_id", team_id),
      supabase
        .from("team_invites")
        .select("id", { count: "exact", head: true })
        .eq("team_id", team_id)
        .eq("status", "pending"),
    ]);
    const seatLimit = team?.seat_limit ?? 1;
    if ((memberCount ?? 0) + (pendingCount ?? 0) >= seatLimit) {
      throw new Error(`Seat limit reached (${seatLimit}). Upgrade your plan to invite more.`);
    }

    // Don't invite existing team member
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, team_id")
      .eq("email", data.email)
      .maybeSingle();
    if (existing?.team_id === team_id) throw new Error("That user is already on your team.");

    // Upsert invite row (service role)
    const { data: invite, error: invErr } = await supabaseAdmin
      .from("team_invites")
      .upsert(
        {
          team_id,
          email: data.email,
          role: data.role,
          invited_by: userId,
          status: "pending",
          accepted_at: null,
        },
        { onConflict: "team_id,email" },
      )
      .select("id")
      .single();
    if (invErr) throw new Error(invErr.message);

    // Send the Supabase auth invite
    const redirectTo = `${process.env.SITE_URL ?? "https://leads.dialingfordollars.co"}/login`;
    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo,
      data: {
        invited_team_id: team_id,
        invited_role: data.role,
        invited_by: userId,
        team_name: team?.name ?? null,
      },
    });
    // If user already exists in auth, inviteUserByEmail errors — still keep invite row so
    // accepting via /login will route them in through the trigger metadata they already have.
    const alreadyRegistered = mailErr?.message?.toLowerCase().includes("already") ?? false;

    return {
      invite_id: invite.id,
      email_sent: !mailErr,
      already_registered: alreadyRegistered,
      message: mailErr ? mailErr.message : "Invitation sent",
    };
  });

export const cancelTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ invite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id, role } = await getCtx(supabase, userId);
    requireAdmin(role);
    const { error } = await supabaseAdmin
      .from("team_invites")
      .delete()
      .eq("id", data.invite_id)
      .eq("team_id", team_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ invite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id, role } = await getCtx(supabase, userId);
    requireAdmin(role);
    const { data: inv } = await supabaseAdmin
      .from("team_invites")
      .select("email, role")
      .eq("id", data.invite_id)
      .eq("team_id", team_id)
      .maybeSingle();
    if (!inv) throw new Error("Invite not found");
    const redirectTo = `${process.env.SITE_URL ?? "https://leads.dialingfordollars.co"}/login`;
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo,
      data: { invited_team_id: team_id, invited_role: inv.role, invited_by: userId },
    });
    return { ok: !error, message: error?.message ?? "Invitation resent" };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid(), role: ROLE }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id, role } = await getCtx(supabase, userId);
    requireAdmin(role);
    if (data.user_id === userId && data.role !== "admin") {
      throw new Error("You cannot demote yourself. Promote another admin first.");
    }
    // Prevent removing the last admin
    if (data.role !== "admin") {
      const { count } = await supabase
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("team_id", team_id)
        .eq("role", "admin");
      const { data: current } = await supabase
        .from("user_roles")
        .select("role")
        .eq("team_id", team_id)
        .eq("user_id", data.user_id)
        .maybeSingle();
      if (current?.role === "admin" && (count ?? 0) <= 1) {
        throw new Error("Cannot demote the last admin");
      }
    }
    // Replace role rows (one role per user per team)
    await supabaseAdmin.from("user_roles").delete().eq("team_id", team_id).eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ team_id, user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id, role } = await getCtx(supabase, userId);
    requireAdmin(role);
    if (data.user_id === userId) throw new Error("You cannot remove yourself.");

    const { data: team } = await supabase
      .from("teams")
      .select("owner_id")
      .eq("id", team_id)
      .maybeSingle();
    if (team?.owner_id === data.user_id) throw new Error("Cannot remove the team owner.");

    // Block removing the last admin
    const { data: target } = await supabase
      .from("user_roles")
      .select("role")
      .eq("team_id", team_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (target?.role === "admin") {
      const { count } = await supabase
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("team_id", team_id)
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("Cannot remove the last admin");
    }

    await supabaseAdmin.from("user_roles").delete().eq("team_id", team_id).eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").update({ team_id: null }).eq("id", data.user_id);
    return { ok: true };
  });
