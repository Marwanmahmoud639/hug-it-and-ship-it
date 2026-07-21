import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BATCH_SIZE = 5000;

export const scaleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ campaignId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { campaignId } = data;

    // Load source campaign
    const { data: source, error: srcErr } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (srcErr || !source) throw new Error(srcErr?.message ?? "Campaign not found");

    // Blocked-keyword guard — re-check before scaling
    const { findBlockedMatches, DEFAULT_BLOCKED_KEYWORDS } = await import("@/lib/blocked-keywords");
    const { data: ts } = await supabase
      .from("team_settings").select("blocked_keywords").eq("team_id", source.team_id).maybeSingle();
    const kwList = (ts?.blocked_keywords as string[] | null) ?? DEFAULT_BLOCKED_KEYWORDS;
    const scan = `${source.subject ?? ""}\n${source.body ?? ""}`;
    const matches = findBlockedMatches(scan, kwList);
    if (matches.length > 0 && source.type === "sms") {
      throw new Error(`Cannot auto-scale — template contains restricted terms: ${matches.join(", ")}`);
    }

    // Find next batch of unused contacts in same team (not already in this campaign chain)
    const rootId = source.parent_campaign_id ?? source.id;
    const { data: chain } = await supabase
      .from("campaigns")
      .select("id")
      .or(`id.eq.${rootId},parent_campaign_id.eq.${rootId}`);
    const chainIds = (chain ?? []).map((r) => r.id);

    const { data: used } = await supabase
      .from("campaign_contacts")
      .select("contact_id")
      .in("campaign_id", chainIds);
    const usedSet = new Set((used ?? []).map((r) => r.contact_id));

    const { data: pool } = await supabase
      .from("contacts")
      .select("id")
      .eq("team_id", source.team_id)
      .eq("opted_out", false)
      .eq("do_not_contact", false)
      .limit(BATCH_SIZE + usedSet.size);

    const nextContacts = (pool ?? [])
      .map((c) => c.id)
      .filter((id) => !usedSet.has(id))
      .slice(0, BATCH_SIZE);

    if (nextContacts.length === 0) {
      throw new Error("No additional contacts available to scale this campaign.");
    }

    // Create child campaign (round + 1)
    const nextRound = (source.campaign_round ?? 1) + 1;
    const childInsert = {
      team_id: source.team_id,
      created_by: userId,
      name: `${source.name.replace(/ \(Round \d+\)$/, "")} (Round ${nextRound})`,
      type: source.type,
      subject: source.subject,
      body: source.body,
      ai_personalization: source.ai_personalization,
      sending_inbox_ids: source.sending_inbox_ids,
      sending_strategy: source.sending_strategy,
      sending_window_enabled: source.sending_window_enabled,
      sending_days: source.sending_days,
      sending_start_time: source.sending_start_time,
      sending_end_time: source.sending_end_time,
      timezone: source.timezone,
      cost_per_lead_threshold: source.cost_per_lead_threshold,
      status: "running" as const,
      campaign_round: nextRound,
      parent_campaign_id: rootId,
      auto_scaled_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    };
    const { data: child, error: childErr } = await supabase
      .from("campaigns")
      .insert(childInsert)
      .select()
      .single();
    if (childErr || !child) throw new Error(childErr?.message ?? "Failed to create scaled campaign");

    // Bulk insert campaign_contacts
    const ccRows = nextContacts.map((cid) => ({
      team_id: source.team_id,
      campaign_id: child.id,
      contact_id: cid,
      status: "pending" as const,
    }));
    // chunk inserts to stay under PostgREST limits
    for (let i = 0; i < ccRows.length; i += 1000) {
      const chunk = ccRows.slice(i, i + 1000);
      const { error: ccErr } = await supabase.from("campaign_contacts").insert(chunk);
      if (ccErr) throw new Error(ccErr.message);
    }

    // Activity + notification
    await supabase.from("activity_log").insert({
      team_id: source.team_id,
      campaign_id: child.id,
      action: "campaign_auto_scaled",
      note: `Auto-scaled from "${source.name}" — round ${nextRound}, ${nextContacts.length} new contacts.`,
    });
    await supabase.from("notifications").insert({
      team_id: source.team_id,
      title: `Auto-uploaded ${nextContacts.length.toLocaleString()} records`,
      body: `"${child.name}" is sending now.`,
      type: "success",
      link: `/campaigns`,
    });

    return { childId: child.id, added: nextContacts.length, round: nextRound };
  });
