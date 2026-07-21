import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "manager" | "agent";
export type Plan = "starter" | "growth" | "agency";

export type Profile = {
  id: string;
  email: string;
  name: string;
  team_id: string | null;
  avatar_url: string | null;
  onboarding_skipped: boolean;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title: string | null;
  timezone: string | null;
  preferred_language: string | null;
};

export type Team = {
  id: string;
  name: string;
  plan: Plan;
  contact_limit: number;
  seat_limit: number;
  white_label_name: string | null;
  white_label_color: string | null;
  white_label_secondary_color: string | null;
  white_label_logo: string | null;
  parent_team_id: string | null;
  subdomain: string | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  team: Team | null;
  homeTeam: Team | null;
  actingTeamId: string | null;
  isImpersonating: boolean;
  role: Role | null;
  sectionAccess: unknown;
  isSuperAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [actingTeamId, setActingTeamId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [sectionAccess, setSectionAccess] = useState<unknown>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile(p as Profile | null);
    const { data: sa } = await supabase.from("super_admins").select("user_id").eq("user_id", uid).maybeSingle();
    setIsSuperAdmin(!!sa);

    // determine acting team (active session overrides home team)
    const { data: ats } = await supabase
      .from("active_team_session" as any)
      .select("acting_team_id")
      .eq("user_id", uid)
      .maybeSingle();
    const actingId = ((ats as any)?.acting_team_id as string | null) ?? (p?.team_id as string | null) ?? null;
    setActingTeamId(actingId);

    if (p?.team_id) {
      const { data: ht } = await supabase.from("teams").select("*").eq("id", p.team_id).maybeSingle();
      setHomeTeam(ht as Team | null);
    } else {
      setHomeTeam(null);
    }

    if (actingId) {
      const [{ data: t }, { data: r }] = await Promise.all([
        supabase.from("teams").select("*").eq("id", actingId).maybeSingle(),
        (supabase.from("user_roles") as any).select("role, section_access").eq("user_id", uid).eq("team_id", actingId).maybeSingle(),
      ]);
      setTeam(t as Team | null);
      // super-admins acting on a foreign team have no user_roles row — grant admin in UI
      const resolvedRole = ((r as any)?.role as Role) ?? (sa && actingId !== p?.team_id ? "admin" : null);
      setRole(resolvedRole);
      setSectionAccess((r as any)?.section_access ?? null);
    } else {
      setTeam(null);
      setRole(null);
      setSectionAccess(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null); setTeam(null); setHomeTeam(null); setActingTeamId(null); setRole(null); setSectionAccess(null); setIsSuperAdmin(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refresh = async () => { if (session?.user) await loadProfile(session.user.id); };
  const signOut = async () => { await supabase.auth.signOut(); };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (team?.white_label_color) root.style.setProperty("--primary", team.white_label_color);
    if (team?.white_label_secondary_color) root.style.setProperty("--secondary", team.white_label_secondary_color);
  }, [team?.white_label_color, team?.white_label_secondary_color]);

  const isImpersonating = !!homeTeam && !!actingTeamId && actingTeamId !== homeTeam.id;

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, profile, team, homeTeam, actingTeamId, isImpersonating, role, sectionAccess, isSuperAdmin, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}


export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
