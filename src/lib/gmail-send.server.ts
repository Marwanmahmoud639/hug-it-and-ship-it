// Server-only Gmail send via App User Connector.
import { getConnectionKeyForUser } from "./appUserConnections.server";
import { callAsAppUser } from "@/integrations/lovable/appUserConnector.server";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_mail";

function encodeRfc2822({ from, to, subject, html }: { from?: string; to: string; subject: string; html: string }): string {
  const lines = [
    from ? `From: ${from}` : null,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].filter(Boolean).join("\r\n");
  // btoa is available in the Worker runtime; use it for base64url encoding.
  return btoa(unescape(encodeURIComponent(lines)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendMailAsUser(
  userId: string,
  msg: { to: string; subject: string; html: string; fromName?: string; fromEmail?: string },
): Promise<{ id: string }> {
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) throw new Error("Gmail is not connected for this user. Connect Gmail in Settings or Onboarding.");

  const from = msg.fromEmail
    ? (msg.fromName ? `${msg.fromName} <${msg.fromEmail}>` : msg.fromEmail)
    : undefined;
  const raw = encodeRfc2822({ from, to: msg.to, subject: msg.subject, html: msg.html });

  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: CONNECTOR_ID,
    path: "/gmail/v1/users/me/messages/send",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail send failed (${res.status}): ${text.slice(0, 400)}`);
  }
  const out = await res.json().catch(() => ({ id: "" }));
  return { id: (out?.id as string) ?? "" };
}
