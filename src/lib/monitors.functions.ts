import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  keyword: z.string().min(1).max(200),
  location: z.string().max(200).optional().default(""),
  industry_filter: z.string().max(100).optional().nullable(),
  title_filters: z.array(z.string()).default(["Owner", "CEO", "Founder"]),
  frequency: z.enum(["weekly", "monthly", "manual"]),
  frequency_day: z.number().int().min(0).max(31).nullable(),
  auto_add_threshold: z.number().int().min(0).max(100).default(70),
  notification_prefs: z.object({
    in_app: z.boolean().default(true),
    email: z.boolean().default(false),
    slack: z.boolean().default(false),
    skip_if_zero: z.boolean().default(true),
  }),
});

function computeNextRun(freq: string, day: number | null): string | null {
  const now = new Date();
  if (freq === "manual") return null;
  if (freq === "weekly") {
    const targetDow = day ?? 1; // Mon
    const next = new Date(now);
    const diff = (targetDow - now.getDay() + 7) % 7 || 7;
    next.setDate(now.getDate() + diff); next.setHours(9, 0, 0, 0);
    return next.toISOString();
  }
  // monthly
  const targetDom = day ?? 1;
  const next = new Date(now.getFullYear(), now.getMonth(), targetDom, 9, 0, 0, 0);
  if (next <= now) next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

export const listMonitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("search_monitors").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const next_run_at = computeNextRun(data.frequency, data.frequency_day);
    if (data.id) {
      const { data: row, error } = await supabase.from("search_monitors").update({
        name: data.name, keyword: data.keyword, location: data.location || null,
        industry_filter: data.industry_filter ?? null, title_filters: data.title_filters,
        frequency: data.frequency, frequency_day: data.frequency_day,
        auto_add_threshold: data.auto_add_threshold,
        notification_prefs: data.notification_prefs as any, next_run_at,
      }).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase.from("search_monitors").insert({
      team_id: profile.team_id, name: data.name, keyword: data.keyword,
      location: data.location || null, industry_filter: data.industry_filter ?? null,
      title_filters: data.title_filters, frequency: data.frequency,
      frequency_day: data.frequency_day, auto_add_threshold: data.auto_add_threshold,
      notification_prefs: data.notification_prefs as any, next_run_at, created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["active", "paused"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("search_monitors").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("search_monitors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runMonitorNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Just mark next_run_at to now so cron picks it up immediately.
    const { error } = await context.supabase.from("search_monitors")
      .update({ next_run_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
