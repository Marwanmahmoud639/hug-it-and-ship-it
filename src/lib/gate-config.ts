// Master gate password for the DFD internal build.
// This is a CLIENT-SIDE soft gate (bundled into the JS) — not a real security boundary.
// Change the password by editing this constant and republishing.
export const AGENCY_GATE_PASSWORD = "dfd2026!";
export const GATE_SESSION_KEY = "agency_gate_passed";
export const GATE_LOCKOUT_KEY = "agency_gate_lockout_until";
export const GATE_FAILS_KEY = "agency_gate_fails";
export const GATE_MAX_FAILS = 5;
export const GATE_LOCKOUT_SECONDS = 30;
