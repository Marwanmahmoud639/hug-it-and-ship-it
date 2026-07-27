import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLATFORMS = ["linkedin", "facebook", "instagram"] as const;

/**
 * Build the provider consent URL and stash a one-time CSRF state.
 *
 * The returned URL is opened by the browser; the provider redirects back to
 * /api/social/callback/<platform>, which exchanges the code for a token.
 */
export const getSocialAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      platform: z.enum(PLATFORMS),
      origin: z.string().url(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { SOCIAL_PROVIDERS, providerCredentials, callbackUrl } = await import("./social-oauth.server");
    const cfg = SOCIAL_PROVIDERS[data.platform];

    const creds = providerCredentials(data.platform);
    if (!creds) {
      throw new Error(
        `${cfg.label} is not configured yet. Set ${cfg.clientIdEnv} and ${cfg.clientSecretEnv}, ` +
        `and register the app in the ${cfg.label} developer console with the redirect URL ` +
        `${callbackUrl(data.origin, data.platform)}`,
      );
    }

    const state = crypto.randomUUID();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("social_oauth_states").insert({
      state,
      user_id: userId,
      platform: data.platform,
    });
    if (error) throw new Error(error.message);

    const url = new URL(cfg.authorizeUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", callbackUrl(data.origin, data.platform));
    url.searchParams.set("scope", cfg.scopes.join(" "));
    url.searchParams.set("state", state);

    return { url: url.toString() };
  });

/**
 * Connections for the current user. Token ciphertext is deliberately never
 * selected here — the UI only needs to know a connection exists.
 */
export const listSocialConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Cast: social_connections is added by migration 20260727052000 and won't
    // appear in the generated types until they're regenerated against the DB.
    const { data } = await (supabase as any)
      .from("social_connections")
      .select("id, platform, scopes, display_name, expires_at, created_at")
      .eq("user_id", userId);

    const { SOCIAL_PROVIDERS, providerCredentials } = await import("./social-oauth.server");
    const providers = (PLATFORMS as readonly string[]).map((p) => {
      const platform = p as (typeof PLATFORMS)[number];
      const cfg = SOCIAL_PROVIDERS[platform];
      return {
        platform,
        label: cfg.label,
        capabilities: cfg.capabilities,
        needsAppReview: cfg.needsAppReview,
        configured: providerCredentials(platform) !== null,
        connection: ((data ?? []) as any[]).find((c) => c.platform === platform) ?? null,
      };
    });
    return { providers };
  });

export const disconnectSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ platform: z.enum(PLATFORMS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Cast: see note in listSocialConnections. RLS still scopes the delete to
    // the caller's own rows regardless of the cast.
    const { error } = await (supabase as any)
      .from("social_connections")
      .delete()
      .eq("user_id", userId)
      .eq("platform", data.platform);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
