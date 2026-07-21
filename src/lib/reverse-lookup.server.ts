import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireTeamKey } from "./tenant-keys.server";

export type LookupQuery = {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: "US" | "CA";
};

export type LookupHit = {
  name?: string;
  phones?: string[];
  emails?: string[];
  address?: string;
  city?: string;
  state?: string;
  age?: string;
  relatives?: string[];
  source_url: string;
  source_title?: string;
  snippet?: string;
};

export type LookupResult = {
  query: LookupQuery;
  hits: LookupHit[];
  source: "cache" | "firecrawl";
  fetched_at: string;
};

function normalizePhone(s?: string) {
  if (!s) return undefined;
  return s.replace(/\D+/g, "").replace(/^1/, "");
}

function hashQuery(q: LookupQuery) {
  const norm = {
    name: q.name?.trim().toLowerCase() || "",
    phone: normalizePhone(q.phone) || "",
    address: q.address?.trim().toLowerCase() || "",
    city: q.city?.trim().toLowerCase() || "",
    state: q.state?.trim().toLowerCase() || "",
    country: q.country || "US",
  };
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex");
}

function buildSearchQuery(q: LookupQuery) {
  const parts: string[] = [];
  if (q.phone) parts.push(`"${normalizePhone(q.phone)}"`);
  if (q.name) parts.push(`"${q.name}"`);
  if (q.address) parts.push(`"${q.address}"`);
  if (q.city) parts.push(q.city);
  if (q.state) parts.push(q.state);
  const sites = q.country === "CA"
    ? "(site:canada411.ca OR site:411.ca OR site:whitepages.ca)"
    : "(site:truepeoplesearch.com OR site:whitepages.com OR site:fastpeoplesearch.com OR site:spokeo.com OR site:beenverified.com)";
  return `${parts.join(" ")} ${sites}`.trim();
}

export async function reverseLookup(q: LookupQuery, teamId: string | null = null): Promise<LookupResult> {
  const country = q.country || "US";
  if (country !== "US" && country !== "CA") {
    throw new Error("Reverse lookup only supports US and Canada");
  }
  const hash = hashQuery(q);

  // 1. Cache
  const { data: cached } = await supabaseAdmin
    .from("ai_lookup_cache")
    .select("result, source, created_at")
    .eq("query_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (cached) {
    return { ...(cached.result as any), source: "cache" };
  }

  // 2. Firecrawl search — uses the acting team's own key (BYO).
  const apiKey = await requireTeamKey(teamId, "firecrawl_api_key", {
    platformEnv: "FIRECRAWL_API_KEY",
    label: "Firecrawl",
    settingsHint: "Settings → Discovery APIs",
  });

  const searchQuery = buildSearchQuery(q);
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: searchQuery,
      limit: 8,
      country: country.toLowerCase(),
      lang: "en",
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Firecrawl search failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  const items: any[] = (j?.data?.web ?? j?.web ?? j?.data ?? []) as any[];

  const hits: LookupHit[] = items.slice(0, 8).map((it) => ({
    source_url: it.url || it.link || "",
    source_title: it.title,
    snippet: it.description || it.snippet,
    name: q.name,
    phones: q.phone ? [q.phone] : undefined,
    address: q.address,
    city: q.city,
    state: q.state,
  })).filter((h) => h.source_url);

  const result: LookupResult = {
    query: q,
    hits,
    source: "firecrawl",
    fetched_at: new Date().toISOString(),
  };

  // 3. Cache
  await supabaseAdmin.from("ai_lookup_cache").insert({
    query_hash: hash,
    query: q as any,
    result: result as any,
    source: "firecrawl",
  });

  return result;
}
