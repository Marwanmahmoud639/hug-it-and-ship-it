import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  filter_type: z.enum(["tag", "stage"]),
  filter_value: z.string().min(1).max(120),
  date_range: z.enum(["7d", "30d", "all"]),
  expires_in_days: z.number().int().nullable(), // null = never
});

export const listPortals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("client_portals").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const expires_at = data.expires_in_days ? new Date(Date.now() + data.expires_in_days * 86400_000).toISOString() : null;
    const { data: row, error } = await supabase.from("client_portals").insert({
      team_id: profile.team_id,
      name: data.name,
      filter_type: data.filter_type,
      filter_value: data.filter_value,
      date_range: data.date_range,
      expires_at,
      created_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const togglePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_portals").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_portals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
