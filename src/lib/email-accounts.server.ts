// Server-only email sending logic. Filename ends in `.server.ts` so the
// TanStack import-protection plugin blocks it from client bundles.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BREVO_GATEWAY = "https://connector-gateway.lovable.dev/brevo";

type SendArgs = { to: string; toName?: string; subject: string; html: string };
type Account = {
  id: string;
  provider: "gmail" | "brevo" | "smtp";
  from_email: string;
  from_name: string | null;
  api_key: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  oauth_refresh_token: string | null;
};

async function sendViaBrevo(acct: Account, m: SendArgs) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const apiKey = acct.api_key || process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Brevo account missing API key");

  if (acct.api_key) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": acct.api_key, accept: "application/json" },
      body: JSON.stringify({
        sender: { name: acct.from_name || acct.from_email, email: acct.from_email },
        to: [{ email: m.to, name: m.toName || m.to }],
        subject: m.subject,
        htmlContent: m.html,
      }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return;
  }
  if (!lovableKey) throw new Error("Brevo gateway not configured");
  const res = await fetch(`${BREVO_GATEWAY}/smtp/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": apiKey },
    body: JSON.stringify({
      sender: { name: acct.from_name || acct.from_email, email: acct.from_email },
      to: [{ email: m.to, name: m.toName || m.to }],
      subject: m.subject,
      htmlContent: m.html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
}

async function sendViaGmail(acct: Account, m: SendArgs) {
  // App User Connector path: use the connected user's Gmail via Lovable connector gateway.
  if ((acct as any).app_user_connector && (acct as any).oauth_user_id) {
    const { sendMailAsUser } = await import("./gmail-send.server");
    await sendMailAsUser((acct as any).oauth_user_id as string, {
      to: m.to,
      subject: m.subject,
      html: m.html,
      fromEmail: acct.from_email,
      fromName: acct.from_name ?? undefined,
    });
    return;
  }
  if (!acct.oauth_refresh_token) throw new Error("Gmail account not connected (missing refresh token)");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth client not configured on the server");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: acct.oauth_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Gmail token refresh ${tokenRes.status}`);
  const { access_token } = await tokenRes.json();

  const raw = [
    `From: ${acct.from_name ? `${acct.from_name} <${acct.from_email}>` : acct.from_email}`,
    `To: ${m.to}`,
    `Subject: ${m.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    m.html,
  ].join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!sendRes.ok) throw new Error(`Gmail send ${sendRes.status}: ${(await sendRes.text().catch(() => "")).slice(0, 200)}`);
}

async function sendViaSmtp(acct: Account, m: SendArgs) {
  if (acct.smtp_host?.includes("sendgrid") && acct.api_key) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${acct.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: m.to, name: m.toName }] }],
        from: { email: acct.from_email, name: acct.from_name || undefined },
        subject: m.subject,
        content: [{ type: "text/html", value: m.html }],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid ${res.status}`);
    return;
  }
  throw new Error("Raw SMTP isn't supported from the serverless runtime. Use Brevo, Gmail, or an HTTP relay (SendGrid/Mailgun) API key.");
}

async function dispatch(acct: Account, m: SendArgs) {
  if (acct.provider === "brevo") return sendViaBrevo(acct, m);
  if (acct.provider === "gmail") return sendViaGmail(acct, m);
  return sendViaSmtp(acct, m);
}

export async function sendBalancedEmail(teamId: string, m: SendArgs, maxTries = 3): Promise<{ accountId: string; provider: string }> {
  let lastErr: unknown = null;
  const tried = new Set<string>();
  for (let i = 0; i < maxTries; i++) {
    const { data: acctId, error } = await (supabaseAdmin as any).rpc("reserve_email_account", { p_team_id: teamId });
    if (error) throw new Error(error.message);
    if (!acctId || tried.has(acctId as string)) break;
    tried.add(acctId as string);

    const { data: acct } = await (supabaseAdmin as any).from("email_accounts").select("*").eq("id", acctId as string).maybeSingle();
    if (!acct) break;
    try {
      await dispatch(acct as Account, m);
      return { accountId: acctId as string, provider: (acct as Account).provider };
    } catch (e) {
      lastErr = e;
      await (supabaseAdmin as any)
        .from("email_accounts")
        .update({ sent_today: Math.max(0, ((acct as any).sent_today ?? 1) - 1) })
        .eq("id", acctId as string);
    }
  }
  throw new Error(
    `No email could be sent across connected accounts.${lastErr ? ` Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}` : " Add an active email account in Settings → Email Infra."}`,
  );
}

export async function adminInsertEmailAccount(row: Record<string, unknown>) {
  const { error } = await (supabaseAdmin as any).from("email_accounts").insert(row);
  if (error) throw new Error(error.message);
}

export async function adminUpdateEmailAccount(id: string, teamId: string, patch: Record<string, unknown>) {
  const { error } = await (supabaseAdmin as any).from("email_accounts").update(patch).eq("id", id).eq("team_id", teamId);
  if (error) throw new Error(error.message);
}

export async function adminDeleteEmailAccount(id: string, teamId: string) {
  const { error } = await (supabaseAdmin as any).from("email_accounts").delete().eq("id", id).eq("team_id", teamId);
  if (error) throw new Error(error.message);
}
