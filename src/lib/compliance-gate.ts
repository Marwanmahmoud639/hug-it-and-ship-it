import { IS_AGENCY } from "./brand";

/** Strict in agency mode = hard block; soft otherwise = warn & allow override. */
export function enforceLevel(): "strict" | "soft" {
  return IS_AGENCY ? "strict" : "soft";
}

/** TCPA hard window — applied SERVER-SIDE for SMS regardless of mode. */
export const TCPA_HARD_START_HOUR = 8;  // 08:00
export const TCPA_HARD_END_HOUR = 21;   // 21:00
