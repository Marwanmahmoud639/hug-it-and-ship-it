import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reverseLookup, type LookupQuery } from "./reverse-lookup.server";

// Tool schemas — kept small to avoid Gemini's constrained-decoding state limit.
export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "search_contacts_db",
      description: "Search the caller's team contacts (your existing leads) by name, phone, email, city, or state. Returns up to 20 matches.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reverse_lookup_web",
      description: "Search public records on the web (US/Canada only) for owner info — given any of name, phone, address, city, state. Use when the contact is NOT already in the DB.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          country: { type: "string", enum: ["US", "CA"] },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_dashboard_stats",
      description: "Get a quick summary of the caller's team data: counts of contacts, active campaigns, recent activity.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_lookup_to_lead",
      description: "Save a person from a lookup result as a contact in the caller's team. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description: "Create a task for the caller. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          notes: { type: "string" },
          due_at: { type: "string", description: "ISO timestamp" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bulk_prospect_search",
      description: "Run a reverse lookup on a batch of up to 100 rows. Each row can have name, phone, address, city, state. Requires user confirmation. Returns a summary; the assistant should warn this consumes Firecrawl credits.",
      parameters: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                phone: { type: "string" },
                address: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
              },
            },
          },
          country: { type: "string", enum: ["US", "CA"] },
        },
        required: ["rows"],
      },
    },
  },
];

// Mark which tools mutate state (need confirmation).
export const MUTATING_TOOLS = new Set(["save_lookup_to_lead", "create_task", "bulk_prospect_search"]);

export type ToolCtx = { userId: string; teamId: string | null };

export async function executeTool(name: string, args: any, ctx: ToolCtx): Promise<any> {
  switch (name) {
    case "search_contacts_db":
      return searchContactsDb(args, ctx);
    case "reverse_lookup_web":
      return reverseLookupWeb(args, ctx);
    case "get_dashboard_stats":
      return dashboardStats(ctx);
    case "save_lookup_to_lead":
      return saveLookupToLead(args, ctx);
    case "create_task":
      return createTask(args, ctx);
    case "bulk_prospect_search":
      return bulkProspectSearch(args, ctx);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function searchContactsDb(a: any, ctx: ToolCtx) {
  if (!ctx.teamId) return { error: "No team context" };
  let q = supabaseAdmin
    .from("contacts")
    .select("id, name, phone, email, city, state, company, lead_score, source")
    .eq("team_id", ctx.teamId)
    .limit(Math.min(a.limit ?? 20, 50));
  if (a.name) q = q.ilike("name", `%${a.name}%`);
  if (a.phone) q = q.ilike("phone", `%${a.phone.replace(/\D/g, "")}%`);
  if (a.email) q = q.ilike("email", `%${a.email}%`);
  if (a.city) q = q.ilike("city", `%${a.city}%`);
  if (a.state) q = q.ilike("state", `%${a.state}%`);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, contacts: data ?? [] };
}

async function reverseLookupWeb(a: any, ctx: ToolCtx) {
  const q: LookupQuery = {
    name: a.name, phone: a.phone, address: a.address,
    city: a.city, state: a.state, country: a.country || "US",
  };
  if (!q.name && !q.phone && !q.address) return { error: "Need at least name, phone, or address" };
  return reverseLookup(q, ctx.teamId);
}

async function dashboardStats(ctx: ToolCtx) {
  if (!ctx.teamId) return { error: "No team context" };
  const [contacts, campaigns] = await Promise.all([
    supabaseAdmin.from("contacts").select("id", { count: "exact", head: true }).eq("team_id", ctx.teamId),
    supabaseAdmin.from("campaigns").select("id", { count: "exact", head: true }).eq("team_id", ctx.teamId).eq("status", "running"),
  ]);
  return {
    contacts_total: contacts.count ?? 0,
    running_campaigns: campaigns.count ?? 0,
  };
}

async function saveLookupToLead(a: any, ctx: ToolCtx) {
  if (!ctx.teamId) return { error: "No team context" };
  const { data, error } = await supabaseAdmin.from("contacts").insert({
    team_id: ctx.teamId,
    name: a.name,
    phone: a.phone || null,
    email: a.email || null,
    city: a.city || null,
    state: a.state || null,
    notes: a.notes || null,
    source: "ai_assistant_lookup",
  }).select("id, name").single();
  if (error) return { error: error.message };
  return { ok: true, contact: data };
}

async function createTask(a: any, ctx: ToolCtx) {
  if (!ctx.teamId) return { error: "No team context" };
  const { data, error } = await supabaseAdmin.from("tasks").insert({
    team_id: ctx.teamId,
    user_id: ctx.userId,
    created_by_user_id: ctx.userId,
    title: a.title,
    notes: a.notes || null,
    due_at: a.due_at || null,
    status: "open",
  } as any).select("id, title").single();
  if (error) return { error: error.message };
  return { ok: true, task: data };
}

async function bulkProspectSearch(a: any, ctx: ToolCtx) {
  const rows = Array.isArray(a.rows) ? a.rows.slice(0, 100) : [];
  if (!rows.length) return { error: "No rows provided" };
  const country = a.country || "US";
  const results: any[] = [];
  for (const r of rows) {
    try {
      const res = await reverseLookup({ ...r, country }, ctx.teamId);
      results.push({ row: r, hits: res.hits.length, top: res.hits[0] });
    } catch (e: any) {
      results.push({ row: r, error: e?.message || "lookup failed" });
    }
  }
  return { processed: results.length, results };
}
