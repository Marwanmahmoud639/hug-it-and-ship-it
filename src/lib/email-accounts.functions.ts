import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// All supabaseAdmin / provider send logic lives in `email-accounts.server.ts`
// and is imported dynamically inside handlers so this file (which is reachable
// from client bundles via Settings → compliance-panels.tsx) stays clean of
// server-only imports.

async function ctx(supabase: any, userId: string) {
  const { data: p } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
  if (!p?.team_id) throw new Error("No team");
  const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("team_id", p.team_id).maybeSingle();
  if (!r || !["admin", "manager"].includes(r.role)) throw new Error("Not authorized");
  return { team_id: p.team_id as string };
}

export const listEmailAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!p?.team_id) return { accounts: [] };
    const { data } = await (supabase as any)
      .from("email_accounts")
      .select("id, provider, label, from_email, from_name, daily_limit, sent_today, is_active, created_at")
      .eq("team_id", p.team_id)
      .order("created_at");
    return { accounts: data ?? [] };
  });

export const addEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: z.enum(["gmail", "brevo", "smtp"]),
        label: z.string().max(80).optional(),
        from_email: z.string().email(),
        from_name: z.string().max(80).optional(),
        daily_limit: z.number().int().min(1).max(100000).default(200),
        api_key: z.string().optional(),
        smtp_host: z.string().optional(),
        smtp_port: z.number().int().optional(),
        smtp_user: z.string().optional(),
        smtp_password: z.string().optional(),
        oauth_refresh_token: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id } = await ctx(supabase, userId);
    const { adminInsertEmailAccount } = await import("./email-accounts.server");
    await adminInsertEmailAccount({ team_id, ...data });
    return { ok: true };
  });

export const updateEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        is_active: z.boolean().optional(),
        daily_limit: z.number().int().min(1).max(100000).optional(),
        label: z.string().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id } = await ctx(supabase, userId);
    const { id, ...patch } = data;
    const { adminUpdateEmailAccount } = await import("./email-accounts.server");
    await adminUpdateEmailAccount(id, team_id, patch);
    return { ok: true };
  });

export const deleteEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id } = await ctx(supabase, userId);
    const { adminDeleteEmailAccount } = await import("./email-accounts.server");
    await adminDeleteEmailAccount(data.id, team_id);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ to: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { team_id } = await ctx(supabase, userId);
    const { sendBalancedEmail } = await import("./email-accounts.server");
    const used = await sendBalancedEmail(team_id, {
      to: data.to,
      subject: "Test email from your CRM",
      html: `<p>This is a load-balanced test email. If you received it, your connected sending accounts are working.</p>`,
    });
    return { ok: true, used };
  });
