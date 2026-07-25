import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchNotification } from "./notifications.server";

const SUPPORT_EMAIL = "support@reach4dollars.com";
const SITE_NAME = "Dialing for Dollars";
const SENDER_DOMAIN = "notify.leads.dialingfordollars.co";
const FROM_DOMAIN = "dialingfordollars.co";

const CATEGORIES = ["credits", "billing", "technical", "feature", "other"] as const;

export const submitSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      category: z.enum(CATEGORIES).default("credits"),
      subject: z.string().trim().min(3).max(200),
      message: z.string().trim().min(10).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as any)?.email ?? "";
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", userId)
      .maybeSingle();
    const teamId = profile?.team_id ?? null;

    let teamName = "";
    let plan = "—";
    let creditsUsed = 0;
    let creditsTotal = 0;
    if (teamId) {
      const { data: team } = await supabase
        .from("teams")
        .select("name, plan, credits_used, credits_total")
        .eq("id", teamId)
        .maybeSingle();
      teamName = (team as any)?.name ?? "";
      plan = (team as any)?.plan ?? "—";
      creditsUsed = Number((team as any)?.credits_used ?? 0);
      creditsTotal = Number((team as any)?.credits_total ?? 0);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("support_requests")
      .insert({
        user_id: userId,
        team_id: teamId,
        email,
        category: data.category,
        subject: data.subject,
        message: data.message,
      })
      .select("id, created_at")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    // In-app notification to every super-admin team
    try {
      const { data: admins } = await supabaseAdmin.from("super_admins").select("user_id");
      const adminIds = (admins ?? []).map((a) => a.user_id);
      if (adminIds.length) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("team_id")
          .in("id", adminIds);
        const teamIds = Array.from(
          new Set((profs ?? []).map((p) => p.team_id).filter(Boolean) as string[]),
        );
        await Promise.all(
          teamIds.map((tid) =>
            dispatchNotification({
              teamId: tid,
              eventType: "system_alert",
              data: {
                reason: `New support request from ${email || "user"} (${teamName || "no team"}) — [${data.category}] ${data.subject}`,
                link: `https://reach4dollars.com/super-admin?support=${inserted.id}`,
              },
            }).catch(() => null),
          ),
        );
      }
    } catch (e) {
      console.error("support notify failed", e);
    }

    // Email to support inbox
    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (apiKey) {
        const { sendLovableEmail } = await import("@lovable.dev/email-js");
        const escape = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;color:#111">
  <h2 style="margin:0 0 12px">New support request</h2>
  <p style="margin:0 0 16px;color:#555">A user submitted an in-app support request.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#666">Category</td><td style="padding:6px 0"><b>${escape(data.category)}</b></td></tr>
    <tr><td style="padding:6px 0;color:#666">Subject</td><td style="padding:6px 0"><b>${escape(data.subject)}</b></td></tr>
    <tr><td style="padding:6px 0;color:#666">User</td><td style="padding:6px 0">${escape(email)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Team</td><td style="padding:6px 0">${escape(teamName)} · ${escape(plan)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Credits</td><td style="padding:6px 0">${creditsUsed.toLocaleString()} / ${creditsTotal.toLocaleString()}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Request ID</td><td style="padding:6px 0"><code>${inserted.id}</code></td></tr>
  </table>
  <h3 style="margin:20px 0 8px">Message</h3>
  <div style="white-space:pre-wrap;padding:12px;background:#f7f7f9;border-radius:8px;border:1px solid #eee">${escape(data.message)}</div>
</div>`;
        const text = `New support request\n\nCategory: ${data.category}\nSubject: ${data.subject}\nUser: ${email}\nTeam: ${teamName} (${plan})\nCredits: ${creditsUsed} / ${creditsTotal}\nRequest ID: ${inserted.id}\n\n${data.message}`;
        await sendLovableEmail(
          {
            to: SUPPORT_EMAIL,
            from: `${SITE_NAME} <no-reply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: `[Support · ${data.category}] ${data.subject}`,
            html,
            text,
            purpose: "transactional",
            label: "support_request",
            reply_to: email || undefined,
            idempotency_key: `support-${inserted.id}`,
          },
          { apiKey },
        );

        // Confirmation email back to the user
        if (email) {
          const confirmHtml = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;color:#111">
  <h2 style="margin:0 0 12px">We got your request</h2>
  <p style="color:#555">Thanks for reaching out — our team will reply to <b>${escape(email)}</b> shortly.</p>
  <p style="color:#666;font-size:14px">Reference: <code>${inserted.id}</code></p>
  <h3 style="margin:20px 0 8px;font-size:15px">Your message</h3>
  <div style="white-space:pre-wrap;padding:12px;background:#f7f7f9;border-radius:8px;border:1px solid #eee">${escape(data.message)}</div>
</div>`;
          await sendLovableEmail(
            {
              to: email,
              from: `${SITE_NAME} Support <support@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject: `We received your request — ${data.subject}`,
              html: confirmHtml,
              text: `We received your request.\n\nReference: ${inserted.id}\n\n${data.message}`,
              purpose: "transactional",
              label: "support_confirmation",
              reply_to: SUPPORT_EMAIL,
              idempotency_key: `support-confirm-${inserted.id}`,
            },
            { apiKey },
          ).catch((e) => console.error("support confirm email failed", e));
        }
      }
    } catch (e) {
      console.error("support email failed", e);
    }

    return { ok: true, id: inserted.id };
  });

export const listMySupportRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("support_requests")
      .select("id, category, subject, status, admin_response, responded_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { rows: data ?? [] };
  });
