import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function resolveMapsKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_KEY ||
    process.env.VITE_GOOGLE_MAPS_KEY ||
    null
  );
}

function parseGoogleLoc(json: any): { lat: number; lng: number } | null {
  const loc = json?.results?.[0]?.geometry?.location;
  if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

let lastNominatimAt = 0;
async function geocodeViaNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { signal: ctrl.signal, headers: { "User-Agent": "ReachForDollars/1.0 (areas-map geocoder)", "Accept-Language": "en" } },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const arr: any[] = await res.json();
    const hit = arr?.[0];
    if (hit?.lat && hit?.lon) {
      const lat = Number(hit.lat), lng = Number(hit.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
    }
  } catch { /* ignore */ }
  return null;
}

async function geocodeOne(query: string): Promise<{ lat: number; lng: number } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const mapsKey = resolveMapsKey();

    if (LOVABLE_API_KEY && mapsKey) {
      try {
        const res = await fetch(
          `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(query)}`,
          { signal: ctrl.signal, headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": mapsKey } },
        );
        if (res.ok) { const hit = parseGoogleLoc(await res.json()); if (hit) return hit; }
      } catch { /* fall through */ }
    }
    if (mapsKey) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${mapsKey}`,
          { signal: ctrl.signal },
        );
        if (res.ok) { const hit = parseGoogleLoc(await res.json()); if (hit) return hit; }
      } catch { /* fall through */ }
    }
  } catch { /* ignore */ } finally {
    clearTimeout(timer);
  }
  // Free keyless fallback so the map always geocodes.
  return geocodeViaNominatim(query);
}

function jitter(n: number): number {
  // ~±80m
  return n + (Math.random() - 0.5) * 0.0016;
}

export const geocodeContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(25) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", userId)
      .single();
    if (!profile?.team_id) throw new Error("No team");

    const { data: rows } = await supabase
      .from("contacts")
      .select("id, name, company, address, city, state, country")
      .in("id", data.ids)
      .eq("team_id", profile.team_id);

    // City-centroid cache: when a query falls back to just "city, state",
    // remember the result so we can detect and jitter co-located businesses.
    const cityCentroids = new Map<string, { lat: number; lng: number }>();
    const queryCache = new Map<string, { lat: number; lng: number } | null>();

    let updated = 0;
    let skipped = 0;

    for (const row of rows ?? []) {
      const address = ((row as any).address ?? "").trim();
      const city = (row.city ?? "").trim();
      const state = (row.state ?? "").trim();
      const country = (row.country ?? "").trim();
      const biz = (row.company ?? row.name ?? "").trim();
      const locSuffix = [city, state, country].filter(Boolean).join(", ");

      if (!address && !locSuffix && !biz) {
        skipped++;
        continue;
      }

      let result: { lat: number; lng: number } | null = null;

      // 0. Most precise: full street address captured at discovery time.
      if (address) {
        if (queryCache.has(address)) result = queryCache.get(address)!;
        else { result = await geocodeOne(address); queryCache.set(address, result); }
      }

      // 1. Try business + location (most specific) when no address.
      if (!result && biz && locSuffix) {
        const q = `${biz}, ${locSuffix}`;
        if (queryCache.has(q)) {
          result = queryCache.get(q)!;
        } else {
          result = await geocodeOne(q);
          queryCache.set(q, result);
        }
      }

      // 2. Fallback to location only
      if (!result && locSuffix) {
        if (queryCache.has(locSuffix)) {
          result = queryCache.get(locSuffix)!;
        } else {
          result = await geocodeOne(locSuffix);
          queryCache.set(locSuffix, result);
        }
        if (result) {
          cityCentroids.set(locSuffix, result);
        }
      }

      if (!result) {
        skipped++;
        continue;
      }

      // If business-query result matches the city centroid exactly, jitter so pins don't stack.
      const centroid = cityCentroids.get(locSuffix);
      let finalLat = result.lat;
      let finalLng = result.lng;
      if (centroid && centroid.lat === result.lat && centroid.lng === result.lng) {
        finalLat = jitter(result.lat);
        finalLng = jitter(result.lng);
      }

      await supabase
        .from("contacts")
        .update({
          lat: finalLat,
          lng: finalLng,
          geocoded_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("team_id", profile.team_id);
      updated++;
    }

    return { updated, skipped };
  });

export const listMappedContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", userId)
      .single();
    if (!profile?.team_id) return { contacts: [], needGeocode: [] as string[] };

    const { data } = await supabase
      .from("contacts")
      .select(
        "id, name, title, company, email, phone, email_verified, phone_verified, lead_score, source, city, state, country, lat, lng, linkedin_url, facebook_url, instagram_url, twitter_url, youtube_url, created_at",
      )
      .eq("team_id", profile.team_id)
      .order("created_at", { ascending: false })
      .limit(5000);

    const rows = data ?? [];

    // Detect collapsed-centroid duplicates: any (lat,lng) shared by 5+ rows
    // is almost certainly a city-only geocode and needs re-geocoding with the
    // business-specific query.
    const coordCounts = new Map<string, number>();
    for (const r of rows as any[]) {
      if (r.lat != null && r.lng != null) {
        const key = `${r.lat},${r.lng}`;
        coordCounts.set(key, (coordCounts.get(key) ?? 0) + 1);
      }
    }
    const collapsedKeys = new Set<string>();
    for (const [k, v] of coordCounts) if (v >= 5) collapsedKeys.add(k);

    const needGeocode = (rows as any[])
      .filter((r) => {
        const hasCoords = r.lat != null && r.lng != null;
        const hasAddress = !!(r.city || r.state || r.company || r.name);
        if (!hasAddress) return false;
        if (!hasCoords) return true;
        return collapsedKeys.has(`${r.lat},${r.lng}`);
      })
      .map((r) => r.id as string)
      .slice(0, 500);

    return { contacts: rows, needGeocode };
  });
