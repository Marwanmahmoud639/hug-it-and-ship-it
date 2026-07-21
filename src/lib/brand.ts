// Single source of truth for R4D brand strings.
export const BRAND = {
  short: "R4D",
  long: "Reach for Deal",
  eyebrow: "R4D",
  tagline: "Reach for Deal",
  pageTitle: "R4D — Reach for Deal",
  loginRestrictedNote: "Access restricted to authorized team members only.",
} as const;

// Build-time flag — set VITE_APP_MODE=agency to expose agency-only features (Proposals).
export const IS_AGENCY = (import.meta.env.VITE_APP_MODE as string | undefined) === "agency";

// Default discovery-call booking link (Cal.com). Used for "Book Meeting" actions
// and as the default CTA for proposals. A team can override per-proposal.
export const BOOKING_URL = "https://cal.com/dialingfordollars/30min-discovery-call";
