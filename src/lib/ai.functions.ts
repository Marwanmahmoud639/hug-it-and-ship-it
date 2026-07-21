import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  prompt: z.string().min(3).max(2000),
  channel: z.string().default("email"),
});

export const generateCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Lovable AI not configured");

    const system = `You write high-converting B2B cold outreach for ${data.channel.toUpperCase()}. Be punchy, personal, and direct. Use {{first_name}}, {{company}}, {{industry}}, {{city}}, {{title}} as merge variables where appropriate. ${data.channel === "sms" ? "Keep under 160 characters." : "Keep under 120 words."} Respond as JSON: {"subject": "...", "body": "..."}. For non-email, omit subject.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Rate limited — try again in a moment");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Workspace settings");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);

    const j = await res.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content);
      return { subject: parsed.subject ?? null, text: parsed.body ?? content };
    } catch {
      return { subject: null, text: content };
    }
  });
