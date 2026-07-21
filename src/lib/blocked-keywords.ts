export const DEFAULT_BLOCKED_KEYWORDS = [
  "out of the blue","county","properties","purchasing","selling","investment",
  "we buy house","we buy houses","sell house","house to sell","sell home","home to sell",
  "your place","your house","abandoned","condemned","probate","estate sale","fixer upper",
  "bid","loan","mortgage","debt","foreclosure","wholesale","distressed","pre-foreclosure",
  "tax lien","credit repair","debt relief","bankruptcy","collections","settlement","lien",
  "payday","refinance","credit card offers","consolidate debt","offer","urgent","fast cash",
  "free","guaranteed","no obligation","act now","limited time","exclusive deal",
  "click here","click below","risk free","no cost","congratulations","winner","selected",
  "get rich","no purchase necessary","while supplies last","once in a lifetime",
  "order now","apply now","do it today","get started now","100% free","free gift","free money",
  "as seen on","bargain","incredible deal","prize","promise","satisfaction guaranteed",
  "trial","unlimited","ammo","ammunition","bullet","firearm","gun","gunpowder",
  "pistol","revolver","rifle","shotgun","silencer","vape","e-cigarette",
  "cannabis","cbd","kratom","marijuana","weed","thc","gambling","casino","betting",
  "jackpot","lottery","miracle cure","weight loss","lose weight","secret formula",
  "diet pill","no exercise required","make money","financial freedom","work from home",
  "earn extra cash","earn extra money","get paid","double your cash","additional income",
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive, word-boundary aware match. Multi-word phrases match as a single
 * phrase. Returns the de-duplicated list of matched keywords (in their original casing
 * from the keyword list, not the source text).
 */
export function findBlockedMatches(text: string, keywords: string[] = DEFAULT_BLOCKED_KEYWORDS): string[] {
  if (!text) return [];
  const matched = new Set<string>();
  for (const raw of keywords) {
    const kw = raw.trim();
    if (!kw) continue;
    // \b doesn't play nicely with punctuation like "%" — use lookaround on word chars
    const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(kw)}(?![A-Za-z0-9])`, "i");
    if (pattern.test(text)) matched.add(kw);
  }
  return Array.from(matched);
}

export type BlockedCheck = {
  matches: string[];
  blocked: boolean; // true for SMS, false for Email (caller decides)
};
