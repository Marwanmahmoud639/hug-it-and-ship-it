/**
 * Skip-trace provider adapter registry — LIVE.
 * Returns empty results when API key is missing (never mock data).
 * 8s timeout per provider, single retry on 5xx, never throws.
 */

export type SkipTraceInput = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  llcAddress?: string | null;
};

export type SkipTracePhone = {
  number: string;
  type: "mobile" | "landline" | "voip" | "toll_free" | "unknown";
  confidence: number; // 0-100
};

export type SkipTraceEmail = {
  email: string;
  type?: string;
};

export type SkipTraceResult = {
  provider: ProviderId;
  phones: SkipTracePhone[];
  emails: SkipTraceEmail[];
  isMock: false;
  error?: string;
};

export type ProviderId = "batch" | "trestle" | "idi" | "spokeo" | "whitepages";

export const PROVIDER_META: Record<ProviderId, { label: string; description: string; baseConfidence: number }> = {
  batch:       { label: "BatchSkipTracing", description: "Fast, affordable, good mobile coverage",          baseConfidence: 65 },
  trestle:     { label: "TRESTLE",          description: "Deep records, strong for LLCs and businesses",     baseConfidence: 60 },
  idi:         { label: "IDI / TLO",        description: "Enterprise — configure custom endpoint in Settings", baseConfidence: 55 },
  spokeo:      { label: "Spokeo",           description: "Consumer records, good backup source",             baseConfidence: 50 },
  whitepages:  { label: "WhitePages Pro",   description: "Final fallback, broad coverage",                   baseConfidence: 45 },
};

const TIMEOUT_MS = 8000;
const empty = (provider: ProviderId, error?: string): SkipTraceResult => ({
  provider, phones: [], emails: [], isMock: false, ...(error ? { error } : {}),
});

function normalizeType(t?: string | null): SkipTracePhone["type"] {
  const s = (t ?? "").toLowerCase();
  if (s.includes("mobile") || s === "cell" || s === "wireless") return "mobile";
  if (s.includes("landline") || s === "fixed") return "landline";
  if (s.includes("voip") || s === "nonfixedvoip") return "voip";
  if (s.includes("toll")) return "toll_free";
  return "unknown";
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status >= 500 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return res;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─── BatchSkipTracing ────────────────────────────────────────────────────────
async function callBatch(input: SkipTraceInput, apiKey: string): Promise<SkipTraceResult> {
  const res = await fetchWithRetry("https://api.batchskiptracing.com/v2/lookup", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
      address: input.llcAddress ?? [input.city, input.state].filter(Boolean).join(", "),
      state: input.state ?? "",
    }),
  });
  if (!res) return empty("batch", "timeout");
  if (!res.ok) return empty("batch", `http ${res.status}`);
  try {
    const d = await res.json();
    const phones: SkipTracePhone[] = (d.phones ?? d.data?.phones ?? []).map((p: any) => ({
      number: p.number ?? p.phone ?? "",
      type: normalizeType(p.type),
      confidence: typeof p.confidence === "number" ? p.confidence : PROVIDER_META.batch.baseConfidence,
    })).filter((p: SkipTracePhone) => p.number);
    const emails: SkipTraceEmail[] = (d.emails ?? d.data?.emails ?? []).map((e: any) => ({
      email: e.email ?? e.address ?? "", type: e.type,
    })).filter((e: SkipTraceEmail) => e.email);
    return { provider: "batch", phones, emails, isMock: false };
  } catch (e: any) {
    return empty("batch", e?.message ?? "parse error");
  }
}

// ─── TrestleIQ 3.1 ───────────────────────────────────────────────────────────
async function callTrestle(input: SkipTraceInput, apiKey: string): Promise<SkipTraceResult> {
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ");
  const addr = input.llcAddress ?? [input.city, input.state].filter(Boolean).join(", ");
  const url = new URL("https://api.trestleiq.com/3.1/person");
  if (addr) url.searchParams.set("addr.street_line_1", addr);
  if (name) url.searchParams.set("name", name);
  const res = await fetchWithRetry(url.toString(), { method: "GET", headers: { "x-api-key": apiKey } });
  if (!res) return empty("trestle", "timeout");
  if (!res.ok) return empty("trestle", `http ${res.status}`);
  try {
    const d = await res.json();
    const persons = d.results?.persons ?? d.persons ?? (Array.isArray(d) ? d : [d]);
    const phones: SkipTracePhone[] = [];
    const emails: SkipTraceEmail[] = [];
    for (const p of persons) {
      for (const ph of p.phones ?? []) {
        if (ph.phone_number) phones.push({
          number: ph.phone_number,
          type: normalizeType(ph.line_type ?? ph.type),
          confidence: PROVIDER_META.trestle.baseConfidence,
        });
      }
      for (const em of p.emails ?? []) {
        if (em.address) emails.push({ email: em.address });
      }
    }
    return { provider: "trestle", phones, emails, isMock: false };
  } catch (e: any) {
    return empty("trestle", e?.message ?? "parse error");
  }
}

// ─── Spokeo ──────────────────────────────────────────────────────────────────
async function callSpokeo(input: SkipTraceInput, apiKey: string): Promise<SkipTraceResult> {
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ");
  const url = new URL("https://api.spokeo.com/v2/search");
  url.searchParams.set("api_key", apiKey);
  if (name) url.searchParams.set("name", name);
  if (input.state) url.searchParams.set("state", input.state);
  const res = await fetchWithRetry(url.toString(), { method: "GET" });
  if (!res) return empty("spokeo", "timeout");
  if (!res.ok) return empty("spokeo", `http ${res.status}`);
  try {
    const d = await res.json();
    const results = d.results ?? [];
    const phones: SkipTracePhone[] = [];
    const emails: SkipTraceEmail[] = [];
    for (const r of results) {
      for (const ph of r.phones ?? []) {
        const num = typeof ph === "string" ? ph : ph.number;
        if (num) phones.push({
          number: num,
          type: normalizeType(typeof ph === "string" ? undefined : ph.type),
          confidence: PROVIDER_META.spokeo.baseConfidence,
        });
      }
      for (const em of r.emails ?? []) {
        const addr = typeof em === "string" ? em : em.email;
        if (addr) emails.push({ email: addr });
      }
    }
    return { provider: "spokeo", phones, emails, isMock: false };
  } catch (e: any) {
    return empty("spokeo", e?.message ?? "parse error");
  }
}

// ─── WhitePages Pro 3.3 ──────────────────────────────────────────────────────
async function callWhitepages(input: SkipTraceInput, apiKey: string): Promise<SkipTraceResult> {
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ");
  const url = new URL("https://proapi.whitepages.com/3.3/person");
  url.searchParams.set("api_key", apiKey);
  if (name) url.searchParams.set("name", name);
  if (input.city) url.searchParams.set("city", input.city);
  if (input.state) url.searchParams.set("state", input.state);
  const res = await fetchWithRetry(url.toString(), { method: "GET" });
  if (!res) return empty("whitepages", "timeout");
  if (!res.ok) return empty("whitepages", `http ${res.status}`);
  try {
    const d = await res.json();
    const results = d.results ?? d.person ?? [];
    const list = Array.isArray(results) ? results : [results];
    const phones: SkipTracePhone[] = [];
    const emails: SkipTraceEmail[] = [];
    for (const r of list) {
      for (const ph of r.phones ?? []) {
        if (ph.phone_number) phones.push({
          number: ph.phone_number,
          type: normalizeType(ph.line_type),
          confidence: PROVIDER_META.whitepages.baseConfidence,
        });
      }
      for (const em of r.emails ?? []) {
        if (em.email_address || em.address) {
          emails.push({ email: em.email_address ?? em.address });
        }
      }
    }
    return { provider: "whitepages", phones, emails, isMock: false };
  } catch (e: any) {
    return empty("whitepages", e?.message ?? "parse error");
  }
}

// ─── IDI / TLO (custom enterprise endpoint) ──────────────────────────────────
async function callIdi(
  input: SkipTraceInput,
  apiKey: string,
  custom?: { endpoint?: string | null; template?: any },
): Promise<SkipTraceResult> {
  if (!custom?.endpoint) return empty("idi", "no endpoint configured");
  // Interpolate {{firstName}} etc. in the template; default body = input
  const body = custom.template
    ? JSON.parse(
        JSON.stringify(custom.template).replace(/\{\{(\w+)\}\}/g, (_, k) => String((input as any)[k] ?? "")),
      )
    : input;
  const res = await fetchWithRetry(custom.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res) return empty("idi", "timeout");
  if (!res.ok) return empty("idi", `http ${res.status}`);
  try {
    const d = await res.json();
    const phones: SkipTracePhone[] = (d.phones ?? []).map((p: any) => ({
      number: p.number ?? p.phone ?? "",
      type: normalizeType(p.type),
      confidence: typeof p.confidence === "number" ? p.confidence : PROVIDER_META.idi.baseConfidence,
    })).filter((p: SkipTracePhone) => p.number);
    const emails: SkipTraceEmail[] = (d.emails ?? []).map((e: any) => ({
      email: e.email ?? e.address ?? "",
    })).filter((e: SkipTraceEmail) => e.email);
    return { provider: "idi", phones, emails, isMock: false };
  } catch (e: any) {
    return empty("idi", e?.message ?? "parse error");
  }
}

export async function callProvider(
  provider: ProviderId,
  input: SkipTraceInput,
  apiKey: string | null | undefined,
  extras?: { idiEndpoint?: string | null; idiTemplate?: any },
): Promise<SkipTraceResult> {
  if (!apiKey && provider !== "idi") return empty(provider, "no key");
  if (provider === "idi") {
    return callIdi(input, apiKey ?? "", { endpoint: extras?.idiEndpoint, template: extras?.idiTemplate });
  }
  try {
    if (provider === "batch") return await callBatch(input, apiKey!);
    if (provider === "trestle") return await callTrestle(input, apiKey!);
    if (provider === "spokeo") return await callSpokeo(input, apiKey!);
    if (provider === "whitepages") return await callWhitepages(input, apiKey!);
    return empty(provider, "unknown provider");
  } catch (e: any) {
    return empty(provider, e?.message ?? "provider error");
  }
}
