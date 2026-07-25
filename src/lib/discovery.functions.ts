import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      keyword: z.string().min(1).max(200),
      location: z.string().max(200).optional().default(""),
      industry: z.string().max(100).optional().nullable(),
      titles: z.array(z.string()).default(["Owner", "CEO", "Founder", "Co-Founder", "President", "C-Suite"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");

    const { data: quota } = await supabase.rpc("consume_trial_quota" as never, {
      _team_id: profile.team_id, _kind: "discovery", _amount: 1,
    } as never);
    const q = quota as { ok: boolean; reason?: string; cap?: number } | null;
    if (q && !q.ok) {
      if (q.reason === "trial_expired") throw new Error("Your 3-day free trial has expired. Upgrade to keep running Discovery.");
      throw new Error(`Trial cap reached: you've used all ${q.cap ?? 100} Discovery searches. Upgrade to continue.`);
    }


    const { data: search, error } = await supabase.from("searches").insert({
      team_id: profile.team_id,
      user_id: userId,
      keyword: data.keyword,
      location: data.location || null,
      industry_filter: data.industry || null,
      title_filters: data.titles,
      status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);

    const steps = ["business", "decisionmakers", "social", "skiptrace", "verify", "score"] as const;
    await supabase.from("search_steps").insert(steps.map(s => ({
      search_id: search.id, team_id: profile.team_id!, step: s, status: "pending" as const,
    })));

    // Await the invoke so the request is actually flushed before this
    // server function returns. The edge function backgrounds the heavy
    // work itself (EdgeRuntime.waitUntil) and returns immediately, so this
    // only waits for the quick ack — not the whole pipeline.
    const { error: invokeError } = await supabase.functions.invoke("discovery-run", {
      body: { search_id: search.id },
    });
    if (invokeError) {
      // Surface the failure instead of leaving the search stuck at 0% (pending) forever.
      await supabase
        .from("searches")
        .update({ status: "failed", error_text: `Failed to start engine: ${invokeError.message}` })
        .eq("id", search.id);
      throw new Error(invokeError.message || "Failed to start discovery engine");
    }

    return { searchId: search.id };
  });

export const startIndividualDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      keyword: z.string().min(1).max(200),
      location: z.string().max(200).optional().default(""),
      platforms: z.array(z.enum(["linkedin", "facebook", "reddit", "google"]))
        .default(["linkedin", "facebook", "google"]),
      roles: z.array(z.string().max(100)).max(20)
        .default(["Wholesaler", "Cash Buyer", "Investor", "Real Estate Agent"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", userId)
      .single();
    if (!profile?.team_id) throw new Error("No team");

    const { data: search, error } = await supabase
      .from("individual_searches")
      .insert({
        team_id: profile.team_id,
        user_id: userId,
        keyword: data.keyword,
        location: data.location || null,
        platforms: data.platforms,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: invokeError } = await supabase.functions.invoke("individual-discovery-run", {
      body: { search_id: search.id, roles: data.roles },
    });
    if (invokeError) {
      await supabase
        .from("individual_searches")
        .update({ status: "failed" })
        .eq("id", search.id);
      throw new Error(invokeError.message || "Failed to start individual discovery engine");
    }

    return { searchId: search.id };
  });

export const listRecentKeywords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) return { keywords: [] as string[] };
    const { data } = await supabase
      .from("searches")
      .select("keyword, created_at")
      .eq("team_id", profile.team_id)
      .order("created_at", { ascending: false })
      .limit(50);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of data ?? []) {
      const k = (row as any).keyword?.trim();
      if (!k) continue;
      const key = k.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(k);
      if (out.length >= 10) break;
    }
    return { keywords: out };
  });

export const getMapsBrowserKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) return { key: null as string | null };
    const { data: settings } = await supabase
      .from("team_settings")
      .select("google_maps_key")
      .eq("team_id", profile.team_id)
      .maybeSingle();
    return { key: (settings?.google_maps_key as string | null) || null };
  });

export const cancelSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ searchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");

    await supabase.from("searches").update({ status: "failed" }).eq("id", data.searchId).eq("team_id", profile.team_id);
    return { success: true };
  });

export const cancelIndividualSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ searchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");

    await supabase.from("individual_searches").update({ status: "failed" }).eq("id", data.searchId).eq("team_id", profile.team_id);
    return { success: true };
  });
