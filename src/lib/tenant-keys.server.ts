import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Per-tenant API key resolver.
 *
 * Sub-accounts / agencies MUST plug in their own provider keys in
 * Settings → Discovery APIs (or AI / Automation tabs). The platform
 * `process.env.*` key is reserved for the super-admin home team only.
 */

const SUPER_ADMIN_EMAIL = "marawanmahmoud4488@gmail.com";

async function isSuperAdminTeam(teamId: string | null): Promise<boolean> {
  if (!teamId) return false;
  const { data: team } = await supabaseAdmin
    .from("teams")
    .select("foundation_owner_id, owner_id, parent_team_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return false;
  // Only root (non-sub) teams qualify, and only when owned by the platform creator.
  if (team.parent_team_id) return false;
  const ownerId = team.foundation_owner_id ?? team.owner_id;
  if (!ownerId) return false;
  const { data: u } = await supabaseAdmin
    .from("super_admins")
    .select("user_id")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (u) return true;
  // Belt + suspenders: also accept the hardcoded email.
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(ownerId);
  return (authUser?.user?.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;
}

/**
 * Fetch a provider key for the acting team.
 *
 * @param teamId   The acting team's id (from auth context).
 * @param column   The `team_settings` column to read (e.g. "firecrawl_api_key").
 * @param platformEnv Optional env var name to fall back to — only honored for the super-admin home team.
 */
export async function getTeamKey(
  teamId: string | null,
  column: string,
  platformEnv?: string,
): Promise<string | null> {
  if (!teamId) return null;
  const { data } = await supabaseAdmin
    .from("team_settings")
    .select(column)
    .eq("team_id", teamId)
    .maybeSingle();
  const value = (data as Record<string, unknown> | null)?.[column];
  if (typeof value === "string" && value.trim()) return value.trim();

  if (platformEnv && (await isSuperAdminTeam(teamId))) {
    const envVal = process.env[platformEnv];
    if (envVal && envVal.trim()) return envVal.trim();
  }
  return null;
}

export async function requireTeamKey(
  teamId: string | null,
  column: string,
  options: { platformEnv?: string; label: string; settingsHint?: string },
): Promise<string> {
  const key = await getTeamKey(teamId, column, options.platformEnv);
  if (!key) {
    const hint = options.settingsHint ?? "Settings → Discovery APIs";
    throw new Error(`${options.label} is not configured. Add your key in ${hint}.`);
  }
  return key;
}
