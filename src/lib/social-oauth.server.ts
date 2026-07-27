// Server-only. OAuth provider configuration for LinkedIn / Facebook / Instagram.
//
// WHAT THESE CONNECTIONS CAN AND CANNOT DO
// ----------------------------------------
// They cannot be used to search for, enumerate, or scrape other people's
// profiles. That is not a policy choice on our side — no consumer OAuth scope
// on any of these platforms grants it:
//
//   LinkedIn  openid/profile/email give the connected member's OWN profile.
//             w_member_social posts as them. People search is Sales Navigator /
//             Talent Solutions, gated behind a signed LinkedIn partnership.
//   Facebook  Third-party profile access was removed in 2018. user_friends
//             returns only friends who also use this app. Public business Pages
//             need Page Public Content Access, granted via Meta App Review.
//   Instagram Basic Display API retired Dec 2024. Graph API covers only
//             Business/Creator accounts the connected user owns.
//
// So: use these for outreach AS the user, and for reading Pages they manage.
// Do not add a "find leads via LinkedIn" path here — it does not exist.

export type SocialPlatform = "linkedin" | "facebook" | "instagram";

export interface ProviderConfig {
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Scopes we request. Keep minimal — extra scopes trigger App Review. */
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Plain-English note surfaced in the UI so expectations stay accurate. */
  capabilities: string;
  /** True when the useful scopes require platform App Review first. */
  needsAppReview: boolean;
}

export const SOCIAL_PROVIDERS: Record<SocialPlatform, ProviderConfig> = {
  linkedin: {
    label: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    // openid/profile/email = who the member is. w_member_social = post as them.
    scopes: ["openid", "profile", "email", "w_member_social"],
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    capabilities: "Post to your LinkedIn feed and read your own profile. Does not provide people search.",
    needsAppReview: false,
  },
  facebook: {
    label: "Facebook",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    // Pages scopes let us read/post to Pages the user manages. Reading OTHER
    // businesses' public Pages additionally needs Page Public Content Access.
    scopes: ["public_profile", "email", "pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    capabilities: "Read and post to Facebook Pages you manage. Does not provide access to other people's profiles.",
    needsAppReview: true,
  },
  instagram: {
    label: "Instagram",
    // Instagram Business auth runs through Facebook Login; the IG account must
    // be a Business/Creator account linked to a Page the user manages.
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    capabilities: "Publish to an Instagram Business account you own. Does not provide profile search.",
    needsAppReview: true,
  },
};

export function providerCredentials(platform: SocialPlatform): { clientId: string; clientSecret: string } | null {
  const cfg = SOCIAL_PROVIDERS[platform];
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function callbackUrl(origin: string, platform: SocialPlatform): string {
  return `${origin}/api/social/callback/${platform}`;
}
