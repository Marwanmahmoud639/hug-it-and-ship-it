import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const slugSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/, "Lowercase letters, digits, hyphens. 1–32 chars.");

const RESERVED = new Set([
  "www", "app", "api", "admin", "leads", "mail", "smtp", "ftp",
  "dev", "staging", "preview", "test", "blog", "help", "support",
  "login", "signup", "auth", "static", "cdn", "assets",
]);

export const requestSubdomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subdomain: string }) => z.object({ subdomain: slugSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = data.subdomain.toLowerCase();
    if (RESERVED.has(slug)) throw new Error("That subdomain is reserved.");

    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const teamId = (profile as any)?.team_id as string | null;
    if (!teamId) throw new Error("No team");

    // require admin of the team
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("team_id", teamId)
      .maybeSingle();
    if ((role as any)?.role !== "admin") throw new Error("Only the sub-account admin can request a subdomain.");

    // Check availability against approved subdomains and teams.subdomain (admin client to bypass RLS for global uniqueness)
    const [{ data: takenTeam }, { data: takenReq }] = await Promise.all([
      supabaseAdmin.from("teams").select("id").ilike("subdomain", slug).maybeSingle(),
      supabaseAdmin.from("subdomain_requests").select("id").eq("status", "approved").ilike("subdomain", slug).maybeSingle(),
    ]);
    if (takenTeam || takenReq) throw new Error("That subdomain is already taken.");

    const { data: inserted, error } = await supabase
      .from("subdomain_requests")
      .insert({ team_id: teamId, requested_by: userId, subdomain: slug, status: "pending" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (inserted as any).id };
  });

export const listMySubdomainRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const teamId = (profile as any)?.team_id as string | null;
    if (!teamId) return { requests: [], approvedSubdomain: null as string | null };
    const { data: t } = await supabase.from("teams").select("subdomain").eq("id", teamId).maybeSingle();
    const { data, error } = await supabase
      .from("subdomain_requests")
      .select("id, subdomain, status, denial_reason, decided_at, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return { requests: data ?? [], approvedSubdomain: (t as any)?.subdomain ?? null };
  });

export const listAllSubdomainRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sa } = await supabase.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (!sa) throw new Error("Super admin only");
    const { data, error } = await supabaseAdmin
      .from("subdomain_requests")
      .select("id, team_id, requested_by, subdomain, status, denial_reason, decided_at, created_at, teams:team_id (name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

export const decideSubdomainRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean; reason?: string }) =>
    z.object({ id: z.string().uuid(), approve: z.boolean(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sa } = await supabase.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (!sa) throw new Error("Super admin only");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("subdomain_requests").select("*").eq("id", data.id).maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Request not found");
    if ((req as any).status !== "pending") throw new Error("Request already decided");

    if (data.approve) {
      const slug = (req as any).subdomain as string;
      // Reject if slug now taken by some team
      const { data: clash } = await supabaseAdmin.from("teams").select("id").ilike("subdomain", slug).neq("id", (req as any).team_id).maybeSingle();
      if (clash) throw new Error("That subdomain is now taken by another team.");
      const { error: upTeam } = await supabaseAdmin.from("teams").update({ subdomain: slug }).eq("id", (req as any).team_id);
      if (upTeam) throw new Error(upTeam.message);
      const { error: upReq } = await supabaseAdmin
        .from("subdomain_requests")
        .update({ status: "approved", decided_by: userId, decided_at: new Date().toISOString(), denial_reason: null })
        .eq("id", data.id);
      if (upReq) throw new Error(upReq.message);
    } else {
      const { error: upReq } = await supabaseAdmin
        .from("subdomain_requests")
        .update({ status: "denied", decided_by: userId, decided_at: new Date().toISOString(), denial_reason: data.reason ?? null })
        .eq("id", data.id);
      if (upReq) throw new Error(upReq.message);
    }
    return { ok: true };
  });
