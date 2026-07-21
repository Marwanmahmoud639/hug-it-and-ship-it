import type { Role } from "./auth";

// UI labels for agency-relabeled roles. DB enum stays admin|manager|agent.
export function roleLabel(role: Role | null | undefined): string {
  if (role === "admin") return "Owner";
  if (role === "manager") return "Manager";
  if (role === "agent") return "Caller";
  return "Member";
}

export type Capability =
  | "view_discovery"
  | "view_analytics"
  | "view_campaigns"
  | "view_team"
  | "view_settings"
  | "view_performance"
  | "view_workflows"
  | "view_monitors"
  | "view_portals"
  | "view_proposals"
  | "export_contacts"
  | "manage_targets"
  | "view_export_log"
  | "log_call";

const CAPS: Record<Role, Capability[]> = {
  admin: [
    "view_discovery", "view_analytics", "view_campaigns", "view_team", "view_settings",
    "view_performance", "view_workflows", "view_monitors", "view_portals", "view_proposals",
    "export_contacts", "manage_targets", "view_export_log", "log_call",
  ],
  manager: [
    "view_discovery", "view_analytics", "view_campaigns",
    "view_performance", "view_workflows", "view_monitors", "view_portals", "view_proposals",
    "export_contacts", "manage_targets", "log_call",
  ],
  agent: ["log_call"],
};

export const MANAGER_EXPORT_LIMIT = 1000;

export function can(role: Role | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return CAPS[role]?.includes(cap) ?? false;
}

// ─── Per-user section access (checkbox-based, overrides role defaults) ────────
export type SectionKey =
  | "dashboard" | "pipeline" | "inbox" | "contacts" | "discovery" | "areas"
  | "campaigns" | "workflows" | "automations" | "proposals" | "monitors"
  | "portals" | "analytics" | "team" | "settings" | "ai_caller";

export const SECTION_CATALOG: { key: SectionKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pipeline", label: "Pipeline" },
  { key: "inbox", label: "Inbox" },
  { key: "contacts", label: "Contacts" },
  { key: "discovery", label: "Discovery" },
  { key: "areas", label: "Areas" },
  { key: "campaigns", label: "Campaigns" },
  { key: "workflows", label: "Workflows" },
  { key: "automations", label: "Automations" },
  { key: "proposals", label: "Proposals" },
  { key: "monitors", label: "Monitors" },
  { key: "portals", label: "Portals" },
  { key: "ai_caller", label: "AI Caller" },
  { key: "analytics", label: "Analytics" },
  { key: "team", label: "Team" },
  { key: "settings", label: "Settings" },
];

const ALWAYS_ON: SectionKey[] = ["dashboard"];

const ROLE_DEFAULT_SECTIONS: Record<Role, SectionKey[]> = {
  admin: SECTION_CATALOG.map((s) => s.key),
  manager: [
    "dashboard", "pipeline", "inbox", "contacts", "discovery", "areas",
    "campaigns", "workflows", "automations", "proposals", "monitors",
    "portals", "analytics",
  ],
  agent: ["dashboard", "pipeline", "inbox", "contacts", "areas"],
};

export function resolveSections(
  role: Role | null | undefined,
  sectionAccess: unknown,
): Set<SectionKey> {
  if (role === "admin") return new Set(SECTION_CATALOG.map((s) => s.key));
  if (Array.isArray(sectionAccess)) {
    const valid = new Set(SECTION_CATALOG.map((s) => s.key));
    const granted = sectionAccess.filter(
      (k): k is SectionKey => typeof k === "string" && valid.has(k as SectionKey),
    );
    return new Set<SectionKey>([...ALWAYS_ON, ...granted]);
  }
  return new Set<SectionKey>(role ? ROLE_DEFAULT_SECTIONS[role] : ALWAYS_ON);
}

export function hasSection(
  role: Role | null | undefined,
  sectionAccess: unknown,
  key: SectionKey,
): boolean {
  return resolveSections(role, sectionAccess).has(key);
}
