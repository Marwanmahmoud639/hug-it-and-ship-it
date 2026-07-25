// Server functions for the Gmail App User Connector: start OAuth, save the
// per-user connection key, check status, send a test email, and disconnect.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_mail";
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.send",
];

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetOrigin: string }) => z.object({ targetOrigin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const clientAPIKey = process.env.GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY;
    if (!clientAPIKey) throw new Error("Gmail connector client not configured");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector.server");
    const { getConnectionKeyForUser } = await import("./appUserConnections.server");
    const existing = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl: data.targetOrigin,
      responseMode: "web_message",
      webMessageTargetOrigin: data.targetOrigin,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: SCOPES },
    });
    return { authorizationUrl };
  });

export const saveGmailConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectionAPIKey: string }) =>
    z.object({ connectionAPIKey: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { saveConnectionKeyForUser } = await import("./appUserConnections.server");
    await saveConnectionKeyForUser(context.userId, CONNECTOR_ID, data.connectionAPIKey);

    // Fetch profile to know which Gmail address the user connected.
    const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector.server");
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: data.connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: "/gmail/v1/users/me/profile",
    });
    let emailAddress: string | null = null;
    if (res.ok) {
      const p = await res.json().catch(() => ({}));
      emailAddress = (p?.emailAddress as string) ?? null;
    }

    // Register / update an email_accounts row so the team's sender pool can
    // pick this Gmail as an App-User-Connector-backed sender.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await (supabaseAdmin as any)
      .from("profiles")
      .select("team_id, name")
      .eq("id", context.userId)
      .maybeSingle();
    const teamId = prof?.team_id;
    if (teamId && emailAddress) {
      const { data: existing } = await (supabaseAdmin as any)
        .from("email_accounts")
        .select("id")
        .eq("team_id", teamId)
        .eq("oauth_user_id", context.userId)
        .eq("app_user_connector", true)
        .maybeSingle();
      if (existing?.id) {
        await (supabaseAdmin as any)
          .from("email_accounts")
          .update({ from_email: emailAddress, from_name: prof?.name ?? null, is_active: true })
          .eq("id", existing.id);
      } else {
        await (supabaseAdmin as any).from("email_accounts").insert({
          team_id: teamId,
          provider: "gmail",
          from_email: emailAddress,
          from_name: prof?.name ?? null,
          app_user_connector: true,
          oauth_user_id: context.userId,
          is_active: true,
          daily_limit: 300,
        });
      }
      // Persist onboarding-friendly fields on the team so step 7 can see it as connected.
      await (supabaseAdmin as any)
        .from("teams")
        .update({ sending_email_provider: "gmail_app_user", sending_email_address: emailAddress })
        .eq("id", teamId);
    }
    return { ok: true, emailAddress };
  });

export const getGmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser } = await import("./appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { connected: false as const };
    const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector.server");
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path: "/gmail/v1/users/me/profile",
    });
    if (!res.ok) return { connected: false as const };
    const p = await res.json().catch(() => ({}));
    return { connected: true as const, emailAddress: (p?.emailAddress as string) ?? null };
  });

export const disconnectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionKeyForUser } = await import("./appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector.server");
      try {
        await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: key, connectorId: CONNECTOR_ID });
      } catch { /* still delete local */ }
      await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("email_accounts")
      .update({ is_active: false })
      .eq("oauth_user_id", context.userId)
      .eq("app_user_connector", true);
    return { ok: true };
  });

export const sendGmailTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { to: string; subject?: string; body?: string }) =>
    z.object({ to: z.string().email(), subject: z.string().max(300).optional(), body: z.string().max(20000).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { sendMailAsUser } = await import("./gmail-send.server");
    await sendMailAsUser(context.userId, {
      to: data.to,
      subject: data.subject ?? "Test from Reach for Dollars",
      html: data.body ?? "<p>Your Gmail is connected and sending correctly. 🎉</p>",
    });
    return { ok: true };
  });
