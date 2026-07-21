import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WARMUP_LIMITS = [20, 40, 75, 100, 150];

function publicKeyFromSeed(seed: string): string {
  // Stand-in for a real DKIM keypair so the UI flow renders end-to-end.
  // Replace with a real key generation step before sending production mail.
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const part = (n: number) => Array.from({ length: n }, (_, i) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[(h >> i) & 63]).join("");
  return `v=DKIM1; k=rsa; p=${part(32)}${part(32)}${part(32)}${part(32)}`;
}

export const addSendingDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domain: z.string().min(3).max(255).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const dkim_public_key = publicKeyFromSeed(`${team_id}|${data.domain}`);
    const { data: row, error } = await supabase.from("sending_domains").insert({
      team_id, domain: data.domain, dkim_public_key,
    }).select().single();
    if (error) throw error;
    return { domain: row, dns: dnsRecordsFor(row.domain, dkim_public_key) };
  });

export function dnsRecordsFor(domain: string, dkimPublicKey: string) {
  return {
    spf: { name: domain, type: "TXT", value: "v=spf1 include:_spf.sendgrid.net include:mailgun.org -all" },
    dkim: { name: `cfd._domainkey.${domain}`, type: "TXT", value: dkimPublicKey },
    dmarc: { name: `_dmarc.${domain}`, type: "TXT", value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@" + domain },
    tracking: { name: `track.${domain}`, type: "CNAME", value: "tracking.r4d.app" },
  };
}

/** DNS-over-HTTPS verifier (Cloudflare 1.1.1.1). Returns flags per record type. */
export const verifyDns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domainId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { data: dom } = await supabase.from("sending_domains").select("*").eq("id", data.domainId).eq("team_id", team_id).maybeSingle();
    if (!dom) throw new Error("domain not found");
    async function dohTxt(name: string): Promise<string[]> {
      try {
        const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, {
          headers: { accept: "application/dns-json" },
        });
        const j = await res.json();
        return (j.Answer ?? []).map((a: any) => String(a.data ?? "").replace(/^"|"$/g, ""));
      } catch { return []; }
    }
    const [spf, dkim, dmarc] = await Promise.all([
      dohTxt(dom.domain).then((arr) => arr.some((v) => v.startsWith("v=spf1"))),
      dohTxt(`cfd._domainkey.${dom.domain}`).then((arr) => arr.some((v) => v.includes("v=DKIM1"))),
      dohTxt(`_dmarc.${dom.domain}`).then((arr) => arr.some((v) => v.startsWith("v=DMARC1"))),
    ]);
    await supabase.from("sending_domains").update({
      spf_configured: spf, dkim_configured: dkim, dmarc_configured: dmarc,
    }).eq("id", dom.id);
    return { spf, dkim, dmarc };
  });

export const addInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    domainId: z.string().uuid(),
    email: z.string().email().max(255),
    smtpHost: z.string().max(255).optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    smtpUser: z.string().max(255).optional(),
    smtpPassword: z.string().max(255).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) throw new Error("No team");
    const { error, data: row } = await supabase.from("sending_inboxes").insert({
      team_id, domain_id: data.domainId, email_address: data.email,
      smtp_host: data.smtpHost, smtp_port: data.smtpPort, smtp_user: data.smtpUser, smtp_password: data.smtpPassword,
      warm_up_stage: 1, daily_limit: WARMUP_LIMITS[0],
    }).select().single();
    if (error) throw error;
    return row;
  });

export const listSendingDomains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const team_id = profile?.team_id;
    if (!team_id) return { domains: [], inboxes: [] };
    const [{ data: domains }, { data: inboxes }] = await Promise.all([
      supabase.from("sending_domains").select("*").eq("team_id", team_id).order("created_at"),
      supabase.from("sending_inboxes").select("*").eq("team_id", team_id).order("created_at"),
    ]);
    return { domains: domains ?? [], inboxes: inboxes ?? [] };
  });
