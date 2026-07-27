import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptConnectionKey } from "@/lib/connectionKeyCrypto.server";
import { SOCIAL_PROVIDERS, providerCredentials, callbackUrl, type SocialPlatform } from "@/lib/social-oauth.server";

// OAuth states older than this are treated as expired.
const STATE_TTL_MS = 15 * 60 * 1000;

function redirect(origin: string, params: Record<string, string>) {
  const url = new URL("/settings", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

/** Fetch the connected account's own id/name for a "Connected as X" label. */
async function fetchIdentity(
  platform: SocialPlatform,
  accessToken: string,
): Promise<{ externalId: string | null; displayName: string | null }> {
  try {
    if (platform === "linkedin") {
      const r = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) return { externalId: null, displayName: null };
      const j = await r.json();
      return { externalId: j.sub ?? null, displayName: j.name ?? null };
    }
    const r = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
    if (!r.ok) return { externalId: null, displayName: null };
    const j = await r.json();
    return { externalId: j.id ?? null, displayName: j.name ?? null };
  } catch {
    return { externalId: null, displayName: null };
  }
}

export const Route = createFileRoute("/api/social/callback/$platform")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const origin = new URL(request.url).origin;
        const platform = params.platform as SocialPlatform;
        if (!SOCIAL_PROVIDERS[platform]) {
          return redirect(origin, { social_error: "Unknown platform" });
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        // The user declined consent, or the provider rejected the request.
        const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (providerError) return redirect(origin, { social_error: providerError });
        if (!code || !state) return redirect(origin, { social_error: "Missing code or state" });

        // Consume the CSRF state. Single-use: deleted whether or not the rest
        // of the exchange succeeds, so a leaked state can't be replayed.
        const { data: stateRow } = await (supabaseAdmin as any)
          .from("social_oauth_states")
          .select("state, user_id, platform, created_at")
          .eq("state", state)
          .maybeSingle();
        if (stateRow) {
          await (supabaseAdmin as any).from("social_oauth_states").delete().eq("state", state);
        }
        if (!stateRow || stateRow.platform !== platform) {
          return redirect(origin, { social_error: "Invalid or expired authorization state" });
        }
        if (Date.now() - new Date(stateRow.created_at).getTime() > STATE_TTL_MS) {
          return redirect(origin, { social_error: "Authorization expired — please try again" });
        }

        const creds = providerCredentials(platform);
        if (!creds) return redirect(origin, { social_error: `${SOCIAL_PROVIDERS[platform].label} is not configured` });

        // Exchange the authorization code for an access token.
        let tokenJson: any;
        try {
          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: callbackUrl(origin, platform),
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
          });
          const res = await fetch(SOCIAL_PROVIDERS[platform].tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          tokenJson = await res.json();
          if (!res.ok || !tokenJson.access_token) {
            const msg = tokenJson?.error_description || tokenJson?.error?.message || "Token exchange failed";
            return redirect(origin, { social_error: String(msg).slice(0, 200) });
          }
        } catch (e) {
          return redirect(origin, { social_error: String(e).slice(0, 200) });
        }

        const identity = await fetchIdentity(platform, tokenJson.access_token);
        const expiresAt = tokenJson.expires_in
          ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
          : null;

        const { data: profile } = await (supabaseAdmin as any)
          .from("profiles")
          .select("team_id")
          .eq("id", stateRow.user_id)
          .maybeSingle();

        const { error: upsertErr } = await (supabaseAdmin as any)
          .from("social_connections")
          .upsert({
            user_id: stateRow.user_id,
            team_id: profile?.team_id ?? null,
            platform,
            access_token_ciphertext: encryptConnectionKey(tokenJson.access_token),
            refresh_token_ciphertext: tokenJson.refresh_token
              ? encryptConnectionKey(tokenJson.refresh_token)
              : null,
            // Providers may grant fewer scopes than requested; record what we
            // actually got rather than what we asked for.
            scopes: typeof tokenJson.scope === "string"
              ? tokenJson.scope.split(/[\s,]+/).filter(Boolean)
              : SOCIAL_PROVIDERS[platform].scopes,
            expires_at: expiresAt,
            external_id: identity.externalId,
            display_name: identity.displayName,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,platform" });
        if (upsertErr) return redirect(origin, { social_error: upsertErr.message.slice(0, 200) });

        return redirect(origin, { social_connected: platform });
      },
    },
  },
});
