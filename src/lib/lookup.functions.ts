import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * People Lookup — a "TruePeopleSearch / ThatsThem"-style reverse lookup.
 *
 * Free-first: builds a targeted site: query against public people-search
 * providers and runs it through Serper (if the acting team has a key),
 * falling back to a DuckDuckGo HTML scrape when no paid key is present.
 * Results are cached in `ai_lookup_cache` for 24h to keep repeat lookups
 * fast and cheap.
 */

export type LookupHit = {
  source_url: string;
  source_title?: string;
  snippet?: string;
  source_name?: string;
};

const US_SITES = [
  "truepeoplesearch.com",
  "thatsthem.com",
  "fastpeoplesearch.com",
  "whitepages.com",
  "spokeo.com",
  "beenverified.com",
  "cyberbackgroundchecks.com",
  "peoplefinder.com",
  "radaris.com",
];
const CA_SITES = ["canada411.ca", "411.ca", "whitepages.ca"];

function normalizePhone(s?: string) {
  if (!s) return "";
  return s.replace(/\D+/g, "").replace(/^1/, "");
}

function buildQuery(input: {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country: "US" | "CA";
}) {
  const parts: string[] = [];
  if (input.phone) {
    const digits = normalizePhone(input.phone);
    if (digits.length >= 7) {
      parts.push(`"${digits}"`);
      if (digits.length === 10) {
        parts.push(
          `OR "(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}"`,
        );
      }
    }
  }
  if (input.name) parts.push(`"${input.name}"`);
  if (input.address) parts.push(`"${input.address}"`);
  if (input.city) parts.push(input.city);
  if (input.state) parts.push(input.state);
  const sites = (input.country === "CA" ? CA_SITES : US_SITES)
    .map((s) => `site:${s}`)
    .join(" OR ");
  parts.push(`(${sites})`);
  return parts.filter(Boolean).join(" ");
}

async function serperSearch(query: string, apiKey: string): Promise<LookupHit[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: 12 }),
  });
  if (!res.ok) throw new Error(`Serper failed (${res.status})`);
  const j: any = await res.json();
  const organic: any[] = j.organic ?? [];
  return organic
    .map((o) => ({
      source_url: String(o.link || ""),
      source_title: o.title,
      snippet: o.snippet,
    }))
    .filter((h) => h.source_url);
}

async function duckSearch(query: string): Promise<LookupHit[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "en-US,en",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const hits: LookupHit[] = [];
  // DuckDuckGo html endpoint: results are anchors with class="result__a"
  const rx =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    let href = m[1];
    try {
      // DDG wraps outbound links in /l/?uddg=…
      const u = new URL(href, "https://duckduckgo.com");
      const target = u.searchParams.get("uddg");
      if (target) href = decodeURIComponent(target);
    } catch { /* keep href */ }
    const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    hits.push({
      source_url: href,
      source_title: strip(m[2]),
      snippet: strip(m[3]),
    });
    if (hits.length >= 12) break;
  }
  return hits;
}

function labelSource(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "web";
  }
}

export const runPeopleLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().max(120).optional().default(""),
        phone: z.string().max(40).optional().default(""),
        address: z.string().max(200).optional().default(""),
        city: z.string().max(80).optional().default(""),
        state: z.string().max(80).optional().default(""),
        country: z.enum(["US", "CA"]).default("US"),
      })
      .refine(
        (v) => (v.name?.trim() || v.phone?.trim() || v.address?.trim()),
        { message: "Enter a name, phone, or address to search." },
      )
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", userId)
      .maybeSingle();
    const teamId = profile?.team_id ?? null;

    // Try cache first (24h TTL is handled by expires_at in the table).
    const cacheKey = JSON.stringify({
      n: data.name?.trim().toLowerCase(),
      p: normalizePhone(data.phone),
      a: data.address?.trim().toLowerCase(),
      c: data.city?.trim().toLowerCase(),
      s: data.state?.trim().toLowerCase(),
      cc: data.country,
    });

    const { data: cached } = await supabaseAdmin
      .from("ai_lookup_cache")
      .select("result, created_at, source")
      .eq("query_hash", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached?.result) {
      return { ...(cached.result as any), source: "cache" as const };
    }

    const query = buildQuery(data);

    let hits: LookupHit[] = [];
    let providerLabel = "duckduckgo";

    // Prefer Serper when the team has a key; otherwise DDG.
    let serperKey: string | null = null;
    if (teamId) {
      const { data: settings } = await supabase
        .from("team_settings")
        .select("serper_api_key")
        .eq("team_id", teamId)
        .maybeSingle();
      serperKey = (settings as any)?.serper_api_key ?? null;
    }

    try {
      if (serperKey) {
        hits = await serperSearch(query, serperKey);
        providerLabel = "serper";
      }
    } catch {
      // fall through to DDG
    }
    if (hits.length === 0) {
      hits = await duckSearch(query);
    }

    hits = hits
      .map((h) => ({ ...h, source_name: labelSource(h.source_url) }))
      .slice(0, 20);

    const result = {
      query: data,
      built_query: query,
      hits,
      source: providerLabel as "serper" | "duckduckgo" | "cache",
      fetched_at: new Date().toISOString(),
    };

    await supabase.from("ai_lookup_cache").insert({
      query_hash: cacheKey,
      query: data as any,
      result: result as any,
      source: providerLabel,
    });

    return result;
  });
