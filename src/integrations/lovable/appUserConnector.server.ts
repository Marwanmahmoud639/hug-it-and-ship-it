// Server-only App User Connector gateway helpers. Never import from browser code.

function requireApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not set");
  return key;
}

export interface AppUserOAuthAuthorizeParams {
  gatewayBaseUrl: string;
  connectorId: string;
  appUserId: string;
  clientAPIKey: string;
  returnUrl: string;
  credentialsConfiguration?: Record<string, unknown>;
  connectionAPIKey?: string;
  responseMode?: "redirect" | "web_message";
  webMessageTargetOrigin?: string;
}

export async function authorizeAppUserOAuth(params: AppUserOAuthAuthorizeParams) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireApiKey()}`,
    "Content-Type": "application/json",
    "X-Client-Api-Key": params.clientAPIKey,
  };
  if (params.connectionAPIKey) headers["X-Connection-Api-Key"] = params.connectionAPIKey;

  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      return_url: params.returnUrl,
      credentials_configuration: params.credentialsConfiguration,
      response_mode: params.responseMode,
      web_message_target_origin: params.webMessageTargetOrigin,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`App User OAuth start failed (${res.status}): ${text.slice(0, 300)}`);
  const body = text ? JSON.parse(text) : {};
  if (!body.authorization_url) throw new Error("Missing authorization_url in OAuth start response");
  return { authorizationUrl: body.authorization_url as string, sessionId: (body.session_id ?? "") as string };
}

export interface CallAsAppUserParams {
  gatewayBaseUrl: string;
  connectionAPIKey: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
}

export async function callAsAppUser({ gatewayBaseUrl, connectionAPIKey, connectorId, path, init }: CallAsAppUserParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", connectionAPIKey);
  return fetch(`${gatewayBaseUrl}/${connectorId}${normalizedPath}`, { ...init, headers });
}

export async function disconnectAppUser(params: { gatewayBaseUrl: string; connectionAPIKey: string; connectorId: string }) {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", params.connectionAPIKey);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/connection`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ connector_id: params.connectorId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`App User disconnect failed (${res.status}): ${text.slice(0, 300)}`);
  }
}
