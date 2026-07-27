import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Counts and outcome rates across the system, plus which saved copy is
 * actually earning replies.
 *
 * Every figure is derived from rows the team already has — nothing is
 * estimated or projected. Where a denominator is zero the rate is reported as
 * null rather than 0, so the UI can say "no data yet" instead of implying a
 * real 0% result.
 */
export const getIntelligenceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("team_id").eq("id", userId).maybeSingle();
    if (!profile?.team_id) throw new Error("No team");
    const teamId = profile.team_id;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const countOf = async (
      table: string,
      build?: (q: any) => any,
    ): Promise<number> => {
      let q = (supabase as any).from(table).select("id", { count: "exact", head: true }).eq("team_id", teamId);
      if (build) q = build(q);
      const { count, error } = await q;
      if (error) return 0;
      return count ?? 0;
    };

    const [
      contactsTotal, contactsNew,
      searchesTotal, searchesRecent,
      campaignsTotal,
      emailsSent, emailsReplied,
      smsSent,
      callsTotal, callsConnected,
    ] = await Promise.all([
      countOf("contacts"),
      countOf("contacts", (q) => q.gte("created_at", since)),
      countOf("searches"),
      countOf("searches", (q) => q.gte("created_at", since)),
      countOf("campaigns"),
      countOf("messages", (q) => q.gte("created_at", since)),
      countOf("messages", (q) => q.gte("created_at", since).not("replied_at", "is", null)),
      countOf("sms_messages", (q) => q.gte("created_at", since)),
      countOf("call_runs", (q) => q.gte("created_at", since)),
      countOf("call_runs", (q) => q.gte("created_at", since).eq("status", "completed")),
    ]);

    // Rate helper: null when there's nothing to divide by, so the UI can
    // distinguish "0% replied" from "nothing sent yet".
    const rate = (num: number, den: number): number | null =>
      den > 0 ? Math.round((num / den) * 1000) / 10 : null;

    // Top copy by reply rate. Requires a minimum send volume so a template
    // that went out twice and got one reply doesn't outrank a proven one.
    const MIN_SENDS_TO_RANK = 5;
    const { data: templates } = await (supabase as any)
      .from("content_templates")
      .select("id, name, kind, platform, industry, times_used, times_responded, times_converted")
      .eq("team_id", teamId)
      .gte("times_used", MIN_SENDS_TO_RANK)
      .order("times_used", { ascending: false })
      .limit(100);

    const ranked = ((templates ?? []) as any[])
      .map((t) => ({
        ...t,
        response_rate: rate(t.times_responded, t.times_used) ?? 0,
        conversion_rate: rate(t.times_converted, t.times_used) ?? 0,
      }))
      .sort((a, b) => b.response_rate - a.response_rate);

    // How much copy exists but has never been sent — dead weight worth pruning
    // or testing.
    const { count: unusedTemplates } = await (supabase as any)
      .from("content_templates")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("times_used", 0);

    return {
      windowDays: data.days,
      totals: {
        contacts: contactsTotal,
        contactsNew,
        searches: searchesTotal,
        searchesRecent,
        campaigns: campaignsTotal,
      },
      outreach: {
        emailsSent,
        emailsReplied,
        emailReplyRate: rate(emailsReplied, emailsSent),
        smsSent,
        callsTotal,
        callsConnected,
        callConnectRate: rate(callsConnected, callsTotal),
      },
      templates: {
        topPerforming: ranked.slice(0, 10),
        rankedCount: ranked.length,
        minSendsToRank: MIN_SENDS_TO_RANK,
        unused: unusedTemplates ?? 0,
      },
    };
  });
