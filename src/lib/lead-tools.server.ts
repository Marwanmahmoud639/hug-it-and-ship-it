type SearchResult = { title: string; snippet: string; link: string };

export async function getTeamId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
  if (!data?.team_id) throw new Error("No team");
  return data.team_id as string;
}

async function webSearch(query: string, serperKey: string | null): Promise<SearchResult[]> {
  if (serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 8, gl: "us", hl: "en" }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        return ((json.organic || []) as any[]).map((r) => ({
          title: String(r.title || ""),
          snippet: String(r.snippet || ""),
          link: String(r.link || ""),
        }));
      }
    } catch {
      // fall through to free search
    }
  }

  try {
    const res = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
        "Accept-Language": "en-US,en",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const out: SearchResult[] = [];
    const rx = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match: RegExpExecArray | null;
    while ((match = rx.exec(html)) !== null && out.length < 8) {
      let link = match[1] || "";
      const wrapped = link.match(/[?&]uddg=([^&]+)/);
      if (wrapped) {
        try { link = decodeURIComponent(wrapped[1]); } catch { /* keep original */ }
      }
      out.push({
        title: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        snippet: match[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        link,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function companyTokens(company: string) {
  return company.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((token) => token.length >= 3 && !["llc", "inc", "the", "and", "group", "company", "corp", "co"].includes(token));
}

function candidateFromResult(result: SearchResult) {
  const title = result.title.replace(/\s*\|\s*(LinkedIn|Facebook).*$/i, "").trim();
  const parts = title.split(/\s*[-–—|·]\s*/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts.slice(0, 3)) {
    if (/\b(CEO|Owner|Founder|President|Principal|Partner|Director|Chief)\b/i.test(part)) continue;
    const words = part.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;
    if (!/^[A-Z][a-zA-Z'\-.]+(?:\s+[A-Z][a-zA-Z'\-.]+)+$/.test(part)) continue;
    return part;
  }
  return null;
}

function strictMatch(result: SearchResult, name: string, company: string, city?: string | null, state?: string | null) {
  const hay = `${result.title} ${result.snippet} ${result.link}`.toLowerCase();
  const [first, ...rest] = name.toLowerCase().split(/\s+/);
  const last = rest[rest.length - 1];
  if (!first || !last || !hay.includes(first) || !hay.includes(last)) return false;
  const companyHit = companyTokens(company).some((token) => hay.includes(token));
  const cityHit = Boolean(city && city.length >= 3 && hay.includes(city.toLowerCase()));
  const stateHit = Boolean(state && state.length >= 2 && hay.includes(state.toLowerCase()));
  return companyHit || cityHit || stateHit;
}

async function findDecisionMaker(args: { company: string; city?: string | null; state?: string | null; website?: string | null }, serperKey: string | null) {
  const loc = [args.city, args.state].filter(Boolean).join(" ");
  const domain = args.website ? (() => {
    try { return new URL(args.website.startsWith("http") ? args.website : `https://${args.website}`).hostname.replace(/^www\./, ""); }
    catch { return null; }
  })() : null;
  const queries = [
    `site:linkedin.com/in "${args.company}" (owner OR founder OR CEO OR president) ${loc}`,
    `"${args.company}" "owner" OR "founder" OR "CEO" OR "president" ${loc}`,
    `"${args.company}" "about" founder owner ${loc}`,
    domain ? `site:${domain} owner founder CEO president` : "",
    `"${args.company}" "LinkedIn" "Founder"`,
    `"${args.company}" "Facebook" owner ${loc}`,
    `"${args.company}" site:opencorporates.com`,
    `"${args.company}" site:bizapedia.com`,
    `"${args.company}" "Secretary of State" ${args.state || ""}`,
    `${args.company} ${loc} owner founder CEO president`,
  ].filter(Boolean);

  const roleRx = /\b(CEO|Owner|Founder|Co[- ]?Founder|President|Principal|Managing\s+Partner|Partner|Chief\s+\w+|Director)\b/i;
  for (const query of queries) {
    const results = await webSearch(query, serperKey);
    for (const result of results) {
      const blob = `${result.title} ${result.snippet}`;
      const role = blob.match(roleRx)?.[0] || null;
      if (!role) continue;
      const name = candidateFromResult(result);
      if (!name) continue;
      if (!strictMatch(result, name, args.company, args.city, args.state)) continue;
      return {
        name,
        title: role,
        source: result.link.includes("linkedin.com") ? "linkedin_search" : "web_search",
        linkedinUrl: result.link.includes("linkedin.com/in") ? result.link : null,
      };
    }
  }
  return null;
}

export async function retryDecisionMakerSearchForContact(supabase: any, teamId: string, contactId: string) {
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, company, city, state, website, business_only, dm_search_attempts")
    .eq("id", contactId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (!contact) throw new Error("Contact not found");
  if (!contact.business_only) return { ok: true, message: "Already has decision maker.", found: false };

  const { data: settings } = await supabase
    .from("team_settings")
    .select("serper_api_key")
    .eq("team_id", teamId)
    .maybeSingle();
  const serperKey = settings?.serper_api_key || process.env.SERPER_API_KEY || null;
  const nextAttempts = Number(contact.dm_search_attempts || 0) + 1;
  const dm = await findDecisionMaker({
    company: contact.company || contact.name,
    city: contact.city,
    state: contact.state,
    website: contact.website,
  }, serperKey);

  if (!dm) {
    await supabase.from("contacts").update({
      dm_search_attempts: nextAttempts,
      dm_last_retry_at: new Date().toISOString(),
    }).eq("id", contact.id).eq("team_id", teamId);
    return { ok: true, found: false, message: `No decision maker found on attempt #${nextAttempts}. The business stays marked B2B.` };
  }

  await supabase.from("contacts").update({
    name: dm.name,
    title: dm.title,
    linkedin_url: dm.linkedinUrl || undefined,
    business_only: false,
    dm_search_attempts: nextAttempts,
    dm_last_retry_at: new Date().toISOString(),
    verification_sources: [dm.source],
  }).eq("id", contact.id).eq("team_id", teamId);

  const { data: newLeadStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("team_id", teamId)
    .eq("position", 0)
    .maybeSingle();

  if (newLeadStage?.id) {
    await supabase.from("pipeline_leads")
      .update({ stage_id: newLeadStage.id })
      .eq("team_id", teamId)
      .eq("contact_id", contact.id);
  }

  await supabase.rpc("consume_credits", { _team_id: teamId, _amount: 0.5, _kind: "discovery_dm_upgrade" });
  return { ok: true, found: true, name: dm.name, message: `Decision maker found: ${dm.name}` };
}