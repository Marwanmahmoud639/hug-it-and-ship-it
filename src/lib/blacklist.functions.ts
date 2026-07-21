import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BLACKLISTS = ["Spamhaus", "Barracuda", "SpamCop", "SURBL"];

export const checkBlacklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domainId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { data: dom } = await supabase.from("sending_domains").select("*").eq("id", data.domainId).eq("team_id", team_id).maybeSingle();
    if (!dom) throw new Error("domain not found");
    const { data: settings } = await supabase.from("team_settings").select("mxtoolbox_api_key").eq("team_id", team_id).maybeSingle();
    const hasKey = !!settings?.mxtoolbox_api_key;
    // Mock: deterministic — 10% chance of being listed
    let seed = 0; for (const c of dom.domain) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const isListed = !hasKey ? (seed % 10 === 0) : false;
    const listed_on = isListed ? [BLACKLISTS[seed % BLACKLISTS.length]] : [];
    await supabase.from("blacklist_checks").insert({
      team_id, domain: dom.domain, is_listed: isListed, listed_on, check_provider: hasKey ? "mxtoolbox" : "mock",
    });
    return { isListed, listedOn: listed_on, mocked: !hasKey };
  });

export const listBlacklistChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) return { items: [] };
    const { data: items } = await supabase.from("blacklist_checks").select("*").eq("team_id", team_id).order("checked_at", { ascending: false }).limit(50);
    return { items: items ?? [] };
  });
