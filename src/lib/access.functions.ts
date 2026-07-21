import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter Engine",
  professional: "Professional Engine",
  enterprise: "Enterprise Engine",
};

function generateCode(): string {
  // 6 digits, leading zeros possible
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

/** Public: check whether an email has a paid (or activated) signup */
export const lookupPaidSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().trim().toLowerCase().email().max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("signups")
      .select("id, email, status, selected_plan_slug, full_name, access_code_used_at")
      .eq("email", data.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { found: false as const };
    return {
      found: true as const,
      status: row.status,
      planSlug: row.selected_plan_slug,
      activated: !!row.access_code_used_at,
    };
  });

/** Public: redeem an access code → create the auth user with chosen password, mark code used */
export const claimAccess = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().toLowerCase().email().max(255),
      code: z.string().trim().regex(/^\d{6}$/),
      password: z.string().min(8).max(128),
      fullName: z.string().trim().min(1).max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: signup, error } = await supabaseAdmin
      .from("signups")
      .select("id, email, status, full_name, selected_plan_slug, access_code, access_code_used_at, access_code_expires_at")
      .eq("email", data.email)
      .eq("access_code", data.code)
      .maybeSingle();

    if (error) throw new Error("Lookup failed");
    if (!signup) throw new Error("Invalid email or access code.");
    if (signup.access_code_used_at) throw new Error("This access code has already been used.");
    if (signup.access_code_expires_at && new Date(signup.access_code_expires_at) < new Date()) {
      throw new Error("This access code has expired. Contact support.");
    }

    // Create the auth user (auto-confirm so they can sign in immediately)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.fullName ?? signup.full_name ?? "",
        plan: signup.selected_plan_slug ?? "starter",
      },
    });

    if (createErr || !created.user) {
      // If user already exists, surface a clean message
      if (/already/i.test(createErr?.message ?? "")) {
        throw new Error("An account with this email already exists. Try signing in instead.");
      }
      throw new Error(createErr?.message ?? "Could not create account.");
    }

    // Mark code used and link user_id
    await supabaseAdmin
      .from("signups")
      .update({
        access_code_used_at: new Date().toISOString(),
        status: "activated",
        user_id: created.user.id,
      })
      .eq("id", signup.id);

    return { ok: true as const, userId: created.user.id, email: data.email };
  });

/** Staff: approve a paid signup → generate one-time 6-digit code, 24h expiry */
export const adminApproveSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ signupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Staff check
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: signup, error } = await supabaseAdmin
      .from("signups")
      .select("id, email, full_name, selected_plan_slug, status, access_code, access_code_used_at")
      .eq("id", data.signupId)
      .maybeSingle();
    if (error || !signup) throw new Error("Signup not found");
    if (signup.access_code_used_at) throw new Error("This signup is already activated.");

    // Generate unique code (retry on rare collision)
    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabaseAdmin
        .from("signups").select("id").eq("access_code", code).maybeSingle();
      if (!clash) break;
      code = generateCode();
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("signups")
      .update({
        access_code: code,
        access_code_expires_at: expiresAt,
        access_code_used_at: null,
        approved_at: new Date().toISOString(),
        approved_by: context.userId,
        status: "approved_awaiting_activation",
      })
      .eq("id", signup.id);

    // Best-effort email via Lovable Emails queue (no-op if not yet configured)
    let emailQueued = false;
    try {
      const planName = PLAN_NAMES[signup.selected_plan_slug ?? "starter"] ?? signup.selected_plan_slug ?? "Reach for Dollars";
      const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email" as any, {
        queue_name: "transactional_emails",
        message: {
          to: signup.email,
          template_name: "access-code",
          subject: "Your Reach for Dollars access code",
          template_data: {
            code,
            firstName: (signup.full_name ?? "").split(" ")[0] || "there",
            planName,
            expiresHours: 24,
          },
          idempotency_key: `access-code-${signup.id}-${code}`,
        },
      });
      if (!enqErr) emailQueued = true;
    } catch { /* email infra not set up yet — code still visible in admin */ }

    return { ok: true as const, code, expiresAt, emailQueued };
  });

/** Staff: regenerate access code (e.g. user lost it) */
export const adminRegenerateCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ signupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("signups")
      .update({
        access_code: code,
        access_code_expires_at: expiresAt,
        access_code_used_at: null,
        status: "approved_awaiting_activation",
      })
      .eq("id", data.signupId);
    return { ok: true as const, code, expiresAt };
  });
