// LLC name patterns commonly used by real estate investors.
export const LLC_PATTERNS = [
  /\bLLC\b/i, /\bL\.?L\.?C\.?\b/i, /\bHoldings?\b/i, /\bProperties\b/i,
  /\bInvestments?\b/i, /\bRealty\b/i, /\bCapital\b/i, /\bGroup\b/i,
  /\bVentures?\b/i, /\bAcquisitions?\b/i, /\bEstates?\b/i, /\bPartners\b/i,
];

export function looksLikeLLC(name: string | null | undefined): boolean {
  if (!name) return false;
  return LLC_PATTERNS.some((re) => re.test(name));
}

export const REAL_ESTATE_KEYWORDS = [
  "cash buyer", "wholesaler", "property", "llc", "real estate",
  "home buyer", "house buyer", "investor", "flip", "flip house",
];

export function isRealEstateContext(industry?: string | null, keyword?: string | null): boolean {
  const ind = (industry ?? "").toLowerCase();
  if (ind.includes("real estate")) return true;
  const k = (keyword ?? "").toLowerCase();
  return REAL_ESTATE_KEYWORDS.some((kw) => k.includes(kw));
}

export const SOS_SUPPORTED_STATES = ["TX", "FL", "CA", "GA", "AZ", "OH"] as const;
export type SosState = (typeof SOS_SUPPORTED_STATES)[number];
