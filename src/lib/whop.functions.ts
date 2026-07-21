import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sessionSchema = z.object({ sessionId: z.string().min(4).max(200) });

export const verifyPurchaseSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sessionSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("whop_purchases")
      .select("id, email, tier, status, created_at")
      .eq("whop_session_id", data.sessionId)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (row.status !== "active" && row.status !== "completed") {
      return { ok: false as const, reason: "not_paid" as const, status: row.status };
    }
    return { ok: true as const, email: row.email, tier: row.tier };
  });
