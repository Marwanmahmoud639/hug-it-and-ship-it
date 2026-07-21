import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell/ui-bits";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Circle, Mail, MessageSquare, Globe, Share2, Sparkles, Bell, Kanban, User, Rocket, Shield, Server, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { IS_AGENCY } from "@/lib/brand";
import { CompliancePanel, EmailInfraPanel } from "@/components/settings/compliance-panels";
import { BlockedKeywordsPanel } from "@/components/settings/blocked-keywords-panel";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { SubdomainRequestPanel } from "@/components/settings/subdomain-request-panel";
import { AccountProfile } from "@/components/settings/account-profile";
import { AutomationApisPanel } from "@/components/settings/automation-apis-panel";
import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { DialerProvidersPanel } from "@/components/settings/dialer-providers-panel";

import { ApiCreditsPanel } from "@/components/settings/api-credits-panel";
import { Webhook } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

function TabTrig({ value, Icon, children }: { value: string; Icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-3 py-2"
    >
      <Icon className="w-4 h-4" />
      {children}
    </TabsTrigger>
  );
}

function Settings() {
  const { team, role, isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!team?.id) return;
    supabase.from("team_settings").select("*").eq("team_id", team.id).maybeSingle().then(({ data }) => setSettings(data));
  }, [team?.id]);

  const save = async (patch: any) => {
    if (!team?.id) return;
    const { error } = await supabase.from("team_settings").update(patch).eq("team_id", team.id);
    if (error) return toast.error(error.message);
    setSettings((s: any) => ({ ...s, ...patch }));
    toast.success("Saved");
  };

  const onboardingDone = !!(settings && (settings.gmail_email || settings.smtp_host || settings.twilio_sid || settings.signalwire_project || settings.telnyx_key || settings.apollo_key || settings.seamless_key));
  const checks = settings ? [
    { label: "Connect email sender (Gmail or SMTP)", ok: !!(settings.gmail_email || settings.smtp_host) },
    { label: "Connect SMS provider (Twilio / SignalWire / Telnyx)", ok: !!(settings.twilio_sid || settings.signalwire_project || settings.telnyx_key) },
    { label: "Add at least one Discovery API key (Apollo, Seamless, …)", ok: !!(settings.apollo_key || settings.seamless_key || settings.leads_gorilla_key) },
  ] : [];
  const doneCount = checks.filter(c => c.ok).length;
  const progressPct = checks.length ? Math.round((doneCount / checks.length) * 100) : 0;

  // Discovery API keys and Social keys are restricted to the assigned admin
  // (team admin role or super admin). All other tabs remain visible so team
  // members can send campaigns, manage notifications, pipeline, account, etc.
  const canManageApiKeys = isAdmin || isSuperAdmin;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto page-in">
      <PageHeader title="Settings" subtitle="Connect integrations, set preferences, manage your team." />

      {!onboardingDone && (
        <Card className="mb-6 p-5 border-l-4 border-l-primary bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="font-semibold" style={{ fontFamily: "Sora" }}>Welcome to C4D</div>
                <span className="text-xs font-mono text-muted-foreground">{doneCount} of {checks.length} complete</span>
              </div>
              <div className="h-1.5 rounded-full bg-background/60 overflow-hidden mt-2">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {checks.map(c => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", c.ok ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40")}>
                      {c.ok && <CheckCircle2 className="w-3 h-3" />}
                    </span>
                    <span className={cn(c.ok && "line-through text-muted-foreground")}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="email">
        <TabsList className="flex-wrap h-auto bg-transparent border-b border-border w-full justify-start gap-1 rounded-none p-0">
          <TabTrig value="email" Icon={Mail}>Email</TabTrig>
          <TabTrig value="sms" Icon={MessageSquare}>SMS</TabTrig>
          <TabTrig value="dialer" Icon={Phone}>Dialer Providers</TabTrig>

          {canManageApiKeys && <TabTrig value="discovery" Icon={Globe}>Discovery APIs</TabTrig>}
          {canManageApiKeys && <TabTrig value="social" Icon={Share2}>Social</TabTrig>}
          <TabTrig value="ai" Icon={Sparkles}>AI</TabTrig>
          <TabTrig value="automation-apis" Icon={Webhook}>Automation APIs</TabTrig>
          <TabTrig value="notifications" Icon={Bell}>Notifications</TabTrig>
          <TabTrig value="pipeline" Icon={Kanban}>Pipeline</TabTrig>
          {isSuperAdmin && <TabTrig value="compliance" Icon={Shield}>Compliance</TabTrig>}
          {isSuperAdmin && <TabTrig value="email-infra" Icon={Server}>Email Infra</TabTrig>}
          <TabTrig value="account" Icon={User}>Account</TabTrig>
          {(team?.plan === "agency" || team?.parent_team_id) && <TabTrig value="white-label" Icon={Sparkles}>White Label</TabTrig>}
        </TabsList>

        <TabsContent value="email" className="mt-4">
          <Card className="p-6 bg-card space-y-6">
            <div>
              <h3 className="font-semibold mb-3">SMTP Provider</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Provider</Label>
                  <Select value={settings?.smtp_provider ?? ""} onValueChange={v => save({ smtp_provider: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                      <SelectItem value="custom">Custom SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Host</Label><Input defaultValue={settings?.smtp_host ?? ""} onBlur={e => save({ smtp_host: e.target.value })} /></div>
                <div><Label>Port</Label><Input type="number" defaultValue={settings?.smtp_port ?? ""} onBlur={e => save({ smtp_port: Number(e.target.value) })} /></div>
                <div><Label>Username</Label><Input defaultValue={settings?.smtp_user ?? ""} onBlur={e => save({ smtp_user: e.target.value })} /></div>
                <div><Label>Password</Label><Input type="password" defaultValue={settings?.smtp_password ?? ""} onBlur={e => save({ smtp_password: e.target.value })} /></div>
                <div><Label>From name</Label><Input defaultValue={settings?.smtp_from_name ?? ""} onBlur={e => save({ smtp_from_name: e.target.value })} /></div>
                <div><Label>From email</Label><Input type="email" defaultValue={settings?.smtp_from_email ?? ""} onBlur={e => save({ smtp_from_email: e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Gmail OAuth wiring ships in Phase 2.</p>
            </div>
            <div>
              <Label>Daily sending limit</Label>
              <Input type="number" defaultValue={settings?.daily_email_limit ?? 100} onBlur={e => save({ daily_email_limit: Number(e.target.value) })} className="max-w-xs" />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <Card className="p-6 bg-card space-y-3">
            <Label>Provider</Label>
            <Select value={settings?.sms_provider ?? ""} onValueChange={v => save({ sms_provider: v })}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="twilio">Twilio</SelectItem>
                <SelectItem value="signalwire">SignalWire</SelectItem>
                <SelectItem value="telnyx">Telnyx</SelectItem>
              </SelectContent>
            </Select>
            {settings?.sms_provider === "twilio" && (
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div><Label>Account SID</Label><Input defaultValue={settings?.twilio_sid ?? ""} onBlur={e => save({ twilio_sid: e.target.value })} /></div>
                <div><Label>Auth Token</Label><Input type="password" defaultValue={settings?.twilio_token ?? ""} onBlur={e => save({ twilio_token: e.target.value })} /></div>
                <div><Label>From Number</Label><Input defaultValue={settings?.twilio_from ?? ""} onBlur={e => save({ twilio_from: e.target.value })} /></div>
              </div>
            )}
            {settings?.sms_provider === "telnyx" && (
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div><Label>API Key</Label><Input type="password" defaultValue={settings?.telnyx_key ?? ""} onBlur={e => save({ telnyx_key: e.target.value })} /></div>
                <div><Label>From Number</Label><Input defaultValue={settings?.telnyx_from ?? ""} onBlur={e => save({ telnyx_from: e.target.value })} /></div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Ensure A2P 10DLC registration for mass SMS in the US.</p>
          </Card>
        </TabsContent>

        <TabsContent value="dialer" className="mt-4">
          <DialerProvidersPanel />
        </TabsContent>



        {canManageApiKeys && <TabsContent value="discovery" className="mt-4">
          <Card className="p-6 bg-card space-y-4">
            <div className="rounded-md border border-border bg-muted/20 p-4">
              <h3 className="font-semibold mb-3 text-sm">Scraping Sources (FREE & Global)</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {[
                  { label: "🌍 Google Maps", desc: "Connected — searches globally", on: true },
                  { label: "🔴 Reddit", desc: "FREE — no key needed — real people", on: true },
                  { label: "🔍 Yelp", desc: settings?.firecrawl_api_key ? "Connected (global)" : "Add Firecrawl key below", on: !!settings?.firecrawl_api_key },
                  { label: "📖 Yellow Pages", desc: settings?.firecrawl_api_key ? "Connected (US/Canada)" : "Add Firecrawl key below", on: !!settings?.firecrawl_api_key },
                  { label: "🏠 BiggerPockets", desc: settings?.firecrawl_api_key ? "Connected (US real estate)" : "Add Firecrawl key below", on: !!settings?.firecrawl_api_key },
                  { label: "🛒 Craigslist", desc: settings?.firecrawl_api_key ? "Connected (US/Canada real estate)" : "Add Firecrawl key below", on: !!settings?.firecrawl_api_key },
                  { label: "🔧 Angi", desc: settings?.firecrawl_api_key ? "Connected (US/Canada contractors)" : "Add Firecrawl key below", on: !!settings?.firecrawl_api_key },
                  { label: "🛡️ BBB", desc: settings?.firecrawl_api_key ? "Connected" : "Add Firecrawl key below", on: !!settings?.firecrawl_api_key },
                ].map(s => (
                  <div key={s.label} className={cn("flex items-start gap-2", !s.on && "opacity-50")}>
                    {s.on
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      : <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                    <div>
                      <p className="font-medium leading-tight">{s.label}</p>
                      <p className="text-muted-foreground text-xs">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Firecrawl ~$83/mo enables Yelp, Yellow Pages, Angi, BBB, BiggerPockets, and Craigslist scraping worldwide.
              </p>
            </div>
            {[
              { key: "firecrawl_api_key", label: "Firecrawl (free web scraping — runs first)", badge: "Free" },
              { key: "hunter_api_key", label: "Hunter.io (free email finder — 25 searches/mo free)", badge: "Free" },
              { key: "lusha_api_key", label: "Lusha (paid email + phone enrichment — fallback after Hunter)", badge: "Paid" },
              { key: "apollo_key", label: "Apollo (paid enrichment + LinkedIn — final fallback)", badge: "Paid" },
              { key: "seamless_key", label: "Seamless AI" },
              { key: "leads_gorilla_key", label: "Leads Gorilla" },
              { key: "google_maps_key", label: "Google Maps (business directory)" },
              { key: "skip_trace_key", label: "Skip Trace" },
              { key: "batch_skip_trace_key", label: "BatchData Skip Trace" },
              { key: "trestle_api_key", label: "Trestle (phone verification)" },
              { key: "facebook_api_key", label: "Facebook Graph API token" },
              { key: "serper_api_key", label: "Serper (Google People Search)" },
              { key: "reddit_client_id", label: "Reddit Client ID (optional, higher rate limits)" },
              { key: "clay_key", label: "Clay (company search)" },
              { key: "ai_ark_key", label: "AI Ark API Key (AI-powered search)" },
              { key: "ai_ark_endpoint", label: "AI Ark Endpoint URL" },
              { key: "apify_key", label: "Apify Token (web scraping)" },
              { key: "apify_actor_id", label: "Apify Actor ID (e.g. apify/web-scraper)" },
            ].map((f: any) => (
              <div key={f.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Label>{f.label}</Label>
                    {f.badge && (
                      <Badge className={`text-[10px] ${f.badge === "Free" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>
                        {f.badge}
                      </Badge>
                    )}
                    {settings?.[f.key] ? <Badge className="text-[10px] bg-[oklch(0.65_0.18_145)]/20 text-[oklch(0.65_0.18_145)]"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge> : <Badge variant="secondary" className="text-[10px]">Not connected</Badge>}
                  </div>
                  <Input type={f.key.endsWith("_endpoint") ? "text" : "password"} placeholder={f.key.endsWith("_endpoint") ? "https://api.example.com/search" : (f.key === "apify_actor_id" ? "apify/web-scraper" : "API key")} defaultValue={settings?.[f.key] ?? ""} onBlur={e => save({ [f.key]: e.target.value })} />
                </div>
              </div>
            ))}
            <div className="flex-1">
              <Label>Default Subreddits (comma-separated)</Label>
              <Input
                placeholder="Wholesaling,RealEstate,investing"
                defaultValue={(settings?.default_subreddits ?? []).join(",")}
                onBlur={e => save({ default_subreddits: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              <h3 className="font-semibold text-sm">Proxy (recommended for scraping)</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Provider</Label>
                  <Select value={settings?.proxy_provider ?? ""} onValueChange={v => save({ proxy_provider: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brightdata">Bright Data</SelectItem>
                      <SelectItem value="smartproxy">Smartproxy</SelectItem>
                      <SelectItem value="oxylabs">Oxylabs</SelectItem>
                      <SelectItem value="custom">Custom HTTP proxy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Proxy URL</Label><Input defaultValue={settings?.proxy_url ?? ""} onBlur={e => save({ proxy_url: e.target.value })} placeholder="http://user:pass@host:port" /></div>
                <div className="sm:col-span-2"><Label>API key (if applicable)</Label><Input type="password" defaultValue={settings?.proxy_api_key ?? ""} onBlur={e => save({ proxy_api_key: e.target.value })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked={settings?.respect_robots ?? true} onChange={e => save({ respect_robots: e.target.checked })} />
                Respect robots.txt
              </label>
            </div>
          </Card>
        </TabsContent>}

        {canManageApiKeys && <TabsContent value="social" className="mt-4">
          <Card className="p-6 bg-card space-y-5">
            <div>
              <h3 className="font-semibold text-sm mb-3">LinkedIn</h3>
              <div className="space-y-3">
                <div><Label>Session Cookie (li_at)</Label><Input type="password" defaultValue={settings?.linkedin_session ?? ""} onBlur={e => save({ linkedin_session: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 bg-muted/30">
                    <div className="text-xs text-muted-foreground">DMs sent today</div>
                    <div className="text-2xl font-bold">{settings?.linkedin_dm_count_today ?? 0}<span className="text-sm text-muted-foreground font-normal"> / 20</span></div>
                  </Card>
                  <Card className="p-3 bg-muted/30">
                    <div className="text-xs text-muted-foreground">Resets at</div>
                    <div className="text-sm font-medium">{settings?.linkedin_dm_reset_at ? new Date(settings.linkedin_dm_reset_at).toLocaleString() : "—"}</div>
                  </Card>
                </div>
                {settings?.linkedin_session && (
                  <p className="text-xs text-muted-foreground">⚠ Cookies expire ~30 days. Re-paste if sends start failing.</p>
                )}
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold text-sm mb-3">Meta (Instagram / Facebook)</h3>
              <div><Label>OAuth Token</Label><Input type="password" defaultValue={settings?.meta_token ?? ""} onBlur={e => save({ meta_token: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Card className="p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">Instagram account</div>
                  <div className="text-sm font-medium truncate">{settings?.meta_ig_account?.username ?? "Not connected"}</div>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">Facebook page</div>
                  <div className="text-sm font-medium truncate">{settings?.meta_fb_page?.name ?? "Not connected"}</div>
                </Card>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="automation-apis" className="mt-4 space-y-4">
          <ApiKeysPanel settings={settings} save={save} />
          {isSuperAdmin && <ApiCreditsPanel teamId={team?.id} />}
          <AutomationApisPanel settings={settings} save={save} />
        </TabsContent>




        <TabsContent value="ai" className="mt-4">
          <Card className="p-6 bg-card space-y-4">
            <div>
              <Label>AI Provider</Label>
              <Select value={settings?.ai_provider ?? "lovable"} onValueChange={v => save({ ai_provider: v })}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable">Lovable AI Gateway (default)</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude (requires API key)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Used for AI personalization and decision-maker verification. Anthropic falls back to Lovable AI if no key is configured.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Label>Claude API Key (Anthropic)</Label>
                {settings?.claude_api_key ? <Badge className="text-[10px] bg-[oklch(0.65_0.18_145)]/20 text-[oklch(0.65_0.18_145)]"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge> : <Badge variant="secondary" className="text-[10px]">Not connected</Badge>}
              </div>
              <Input type="password" placeholder="sk-ant-…" defaultValue={settings?.claude_api_key ?? ""} onBlur={e => save({ claude_api_key: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Used directly for Claude sub-agent calls (email + ICP verification). Leave empty to use Lovable AI Gateway.</p>
            </div>
            <div className="border-t border-border pt-4">
              <Label>Ideal Customer Profile (ICP)</Label>
              <textarea
                className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. Tech companies, 50-500 employees, Series B+ funded, in Austin"
                defaultValue={settings?.icp_definition ?? ""}
                onBlur={e => save({ icp_definition: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Free-form description of your ideal prospect. AI uses this to score ICP fit for every discovered contact.</p>
            </div>
          </Card>
        </TabsContent>


        <TabsContent value="pipeline" className="mt-4">
          <Card className="p-6 bg-card space-y-4">
            <div>
              <Label>Mark lead as gone cold after X days of no activity</Label>
              <Input type="number" className="max-w-xs" defaultValue={settings?.cold_lead_days ?? 14} onBlur={e => save({ cold_lead_days: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Auto-add to pipeline at lead score ≥</Label>
              <Input type="number" min={0} max={100} className="max-w-xs" defaultValue={settings?.auto_pipeline_threshold ?? 70} onBlur={e => save({ auto_pipeline_threshold: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground mt-1">Discovery results scoring at or above this value are auto-added to the "New Lead" pipeline stage.</p>
            </div>
          </Card>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="compliance" className="mt-4 space-y-4">
            <CompliancePanel settings={settings} save={save} />
            <BlockedKeywordsPanel settings={settings} save={save} />
            {!IS_AGENCY && (
              <p className="text-xs text-muted-foreground mt-3">
                Hard-block enforcement is enabled only in agency mode. In your current plan, compliance violations show as warnings.
              </p>
            )}
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="email-infra" className="mt-4">
            <EmailInfraPanel />
          </TabsContent>
        )}

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab settings={settings} save={save} />
        </TabsContent>

        <TabsContent value="account" className="mt-4 space-y-4">
          <AccountProfile />
          <Card className="p-6 bg-card space-y-3">
            <div>Current plan: <Badge className="capitalize">{team?.plan}</Badge></div>
            <div className="text-sm text-muted-foreground">Contact limit: {team?.contact_limit?.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Seat limit: {team?.seat_limit}</div>
            <Button variant="outline">Contact us to upgrade</Button>
          </Card>
        </TabsContent>

        <TabsContent value="white-label" className="mt-4 space-y-4">
          {team?.parent_team_id ? (
            <SubdomainRequestPanel />
          ) : (
            <Card className="p-6 bg-card space-y-3">
              <p className="text-sm text-muted-foreground">
                Sub-account subdomains are requested from inside each sub-account. Switch into a sub-account from the Agency page, then visit Settings → White-label here to request a branded subdomain.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
