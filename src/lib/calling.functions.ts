import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mintVoiceAccessToken } from "@/lib/twilio.server";

export const getVoiceAccessToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const token = mintVoiceAccessToken({ identity: `user_${context.userId}` });
      return { token, identity: `user_${context.userId}`, error: null as string | null };
    } catch (e: any) {
      return { token: null as string | null, identity: null, error: e?.message || "Twilio not configured" };
    }
  });

const LogSchema = z.object({
  contact_id: z.string().uuid().optional().nullable(),
  phone_number: z.string().min(3).max(40),
  direction: z.enum(["outbound", "inbound"]),
  duration_seconds: z.number().int().min(0).max(86400).optional().nullable(),
  call_status: z.string().max(40).optional().nullable(),
  twilio_sid: z.string().max(64).optional().nullable(),
});

export const logCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(LogSchema.parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const { error } = await supabase.from("call_history").insert({
      team_id: profile.team_id,
      user_id: userId,
      contact_id: data.contact_id ?? null,
      phone_number: data.phone_number,
      direction: data.direction,
      duration_seconds: data.duration_seconds ?? null,
      call_status: data.call_status ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
