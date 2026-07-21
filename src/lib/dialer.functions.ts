import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProviderIdSchema = z.enum([
  "twilio",
  "telnyx",
  "bandwidth",
  "vonage",
  "plivo",
  "signalwire",
  "custom_sip",
]);

async function teamId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.team_id) throw new Error("No team");
  return data.team_id as string;
}

async function assertManageRights(supabase: any, userId: string, _team_id: string) {
  // RLS already enforces this; the readable error here is just a friendlier guard.
  const { data: t } = await supabase
    .from("teams")
    .select("foundation_owner_id")
    .eq("id", _team_id)
    .maybeSingle();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("team_id", _team_id);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  const isOwner = t?.foundation_owner_id === userId;
  if (!isAdmin && !isOwner) {
    throw new Error("Only the foundation owner or an admin can manage dialer providers");
  }
}

export const listProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const tid = await teamId(supabase, userId);
    const { data, error } = await supabase
      .from("team_dialer_providers")
      .select("id, provider, is_active, from_number, display_name, credentials, updated_at")
      .eq("team_id", tid)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    // Mask secret values before returning
    const masked = (data ?? []).map((row: any) => {
      const creds = row.credentials ?? {};
      const safe: Record<string, string> = {};
      for (const [k, v] of Object.entries(creds)) {
        if (typeof v !== "string" || !v) continue;
        safe[k] = v.length > 4 ? "••••" + v.slice(-4) : "••••";
      }
      return { ...row, credentials: safe };
    });
    return { providers: masked };
  });

export const upsertProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        provider: ProviderIdSchema,
        from_number: z.string().min(3).max(40).nullable().optional(),
        display_name: z.string().max(120).nullable().optional(),
        credentials: z.record(z.string(), z.string().max(2048)).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const tid = await teamId(supabase, userId);
    await assertManageRights(supabase, userId, tid);

    // Merge with existing credentials so users can update a single field
    const { data: existing } = await supabase
      .from("team_dialer_providers")
      .select("credentials")
      .eq("team_id", tid)
      .eq("provider", data.provider)
      .maybeSingle();
    const mergedCreds = { ...((existing?.credentials as Record<string, string> | null) ?? {}), ...(data.credentials ?? {}) };

    const { error } = await supabase
      .from("team_dialer_providers")
      .upsert(
        {
          team_id: tid,
          provider: data.provider,
          credentials: mergedCreds,
          from_number: data.from_number ?? null,
          display_name: data.display_name ?? null,
        },
        { onConflict: "team_id,provider" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setActiveProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ provider: ProviderIdSchema }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const tid = await teamId(supabase, userId);
    await assertManageRights(supabase, userId, tid);
    // Single-active partial unique index requires we deactivate others first
    await supabase
      .from("team_dialer_providers")
      .update({ is_active: false })
      .eq("team_id", tid);
    const { error } = await supabase
      .from("team_dialer_providers")
      .update({ is_active: true })
      .eq("team_id", tid)
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ provider: ProviderIdSchema }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const tid = await teamId(supabase, userId);
    await assertManageRights(supabase, userId, tid);
    const { error } = await supabase
      .from("team_dialer_providers")
      .delete()
      .eq("team_id", tid)
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
