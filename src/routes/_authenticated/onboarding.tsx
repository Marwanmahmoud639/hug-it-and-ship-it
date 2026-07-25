import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getOnboarding, saveOnboardingStep, scanDomain, generateSampleLeads, completeOnboarding,
  savePersonas, saveFirmographics, saveSignalBrief, saveSendingEmail,
} from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ArrowRight, ArrowLeft, Sparkles, Globe, Users, Building2,
  FileSearch, Zap, CreditCard, CheckCircle2, X, Plus, Mail,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

const STEPS = [
  { id: 1, name: "Business", icon: Building2 },
  { id: 2, name: "How it works", icon: Sparkles },
  { id: 3, name: "Your website", icon: Globe },
  { id: 4, name: "People", icon: Users },
  { id: 5, name: "Companies", icon: Building2 },
  { id: 6, name: "Signal brief", icon: FileSearch },
  { id: 7, name: "Connect", icon: Zap },
  { id: 8, name: "Sample leads", icon: Sparkles },
  { id: 9, name: "Start trial", icon: CreditCard },
];

function OnboardingPage() {
  const nav = useNavigate();
  const { team } = useAuth();
  const load = useServerFn(getOnboarding);
  const save = useServerFn(saveOnboardingStep);
  const q = useQuery({ queryKey: ["onboarding"], queryFn: () => load() });
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (q.data?.progress?.current_step) setStep(q.data.progress.current_step);
    if (q.data?.team?.onboarding_completed_at) nav({ to: "/dashboard" });
  }, [q.data]);

  const progress = q.data?.progress;
  const goTo = async (n: number, patch: any = {}) => {
    setStep(n);
    try { await save({ data: { step: n, patch } }); q.refetch(); } catch (e: any) { toast.error(e.message); }
  };

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            {STEPS.map((s) => (
              <div key={s.id} className={`h-1.5 flex-1 rounded-full transition-colors ${s.id < step ? "bg-primary" : s.id === step ? "bg-primary/70" : "bg-muted"}`} />
            ))}
          </div>
          <div className="text-xs text-muted-foreground">Step {step} of {STEPS.length} · {STEPS[step-1].name}</div>
        </div>

        {step === 1 && <Step1Business progress={progress} onNext={(name: string) => goTo(2, { business_name: name })} />}
        {step === 2 && <Step2HowItWorks onBack={() => goTo(1)} onNext={() => goTo(3)} />}
        {step === 3 && <Step3Domain progress={progress} onBack={() => goTo(2)} onNext={() => { q.refetch(); setStep(4); }} />}
        {step === 4 && <Step4People progress={progress} onBack={() => goTo(3)} onNext={() => goTo(5)} />}
        {step === 5 && <Step5Companies progress={progress} onBack={() => goTo(4)} onNext={() => goTo(6)} />}
        {step === 6 && <Step6Brief progress={progress} onBack={() => goTo(5)} onNext={() => goTo(7)} />}
        {step === 7 && <Step7Connect progress={progress} onBack={() => goTo(6)} onNext={() => goTo(8)} />}
        {step === 8 && <Step8Sample progress={progress} onBack={() => goTo(7)} onNext={() => goTo(9)} />}
        {step === 9 && <Step9Trial team={team} onBack={() => goTo(8)} />}
      </div>
    </div>
  );
}

// ---------------- Step 1 ----------------
function Step1Business({ progress, onNext }: any) {
  const [name, setName] = useState(progress?.business_name ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">What's your business called?</h1>
      <p className="text-muted-foreground text-sm mb-6">We'll set up your dashboard under this name. You can change it later.</p>
      <Label htmlFor="bn">Business name</Label>
      <Input id="bn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Growth Co" className="mt-1" autoFocus />
      <Button
        className="w-full mt-6"
        disabled={!name.trim() || busy}
        onClick={async () => {
          setBusy(true);
          try {
            onNext(name.trim());
            // fake "setting up dashboard" beat
            await new Promise((r) => setTimeout(r, 400));
          } finally { setBusy(false); }
        }}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Setting up dashboard <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </Card>
  );
}

// ---------------- Step 2 ----------------
function Step2HowItWorks({ onBack, onNext }: any) {
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">Here's how we work</h1>
      <p className="text-muted-foreground text-sm mb-6">Cold outreach is broken. We fix it.</p>
      <div className="space-y-4">
        {[
          { title: "1. We pull B2B business data", body: "Discovery scans Google Maps, LinkedIn, public directories, and paid enrichment APIs (if you add keys). No burned lists." },
          { title: "2. We surface the decision-makers", body: "Names, verified mobile, email, LinkedIn — every DM automatically feeds your pipeline as a new lead." },
          { title: "3. Your team runs the 5-channel sequence", body: "Email, SMS, DM, cold call, ringless voicemail — coordinated so responses land in one inbox." },
        ].map((x, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
            <div>
              <div className="font-semibold text-sm">{x.title}</div>
              <div className="text-sm text-muted-foreground">{x.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-8">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button className="flex-1" onClick={onNext}>Got it <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </Card>
  );
}

// ---------------- Step 3 ----------------
function Step3Domain({ progress, onBack, onNext }: any) {
  const [domain, setDomain] = useState(progress?.domain ?? "");
  const [busy, setBusy] = useState(false);
  const scan = useServerFn(scanDomain);
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">What's your website?</h1>
      <p className="text-muted-foreground text-sm mb-6">We'll read your homepage to auto-build your ideal customer profile. You can edit everything before saving.</p>
      <Label htmlFor="dom">Your domain</Label>
      <Input id="dom" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acmegrowth.com" className="mt-1" autoFocus />
      <div className="flex gap-2 mt-6">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button
          className="flex-1"
          disabled={!domain.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await scan({ data: { domain: domain.trim() } });
              toast.success("Scan complete");
              onNext();
            } catch (e: any) { toast.error(e.message || "Scan failed"); }
            finally { setBusy(false); }
          }}
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Scanning your site…</> : <>Scan <ArrowRight className="w-4 h-4 ml-2" /></>}
        </Button>
      </div>
    </Card>
  );
}

// ---------------- Reusable chip editor ----------------
function ChipList({ items, onChange, placeholder = "Add", max = 20 }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number }) {
  const [v, setV] = useState("");
  const add = () => {
    const t = v.trim();
    if (!t || items.includes(t) || items.length >= max) return;
    onChange([...items, t]); setV("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((it) => (
          <Badge key={it} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
            {it}
            <button className="ml-1 hover:text-destructive" onClick={() => onChange(items.filter(x => x !== it))}><X className="w-3 h-3" /></button>
          </Badge>
        ))}
        {items.length === 0 && <span className="text-xs text-muted-foreground">Nothing yet — add one below.</span>}
      </div>
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <Button type="button" variant="outline" onClick={add}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

// ---------------- Step 4: personas ----------------
function Step4People({ progress, onBack, onNext }: any) {
  const persist = useServerFn(savePersonas);
  const p = progress?.personas ?? {};
  const [titles, setTitles] = useState<string[]>(p.job_titles ?? []);
  const [locations, setLocations] = useState<string[]>(p.locations ?? []);
  const [keywords, setKeywords] = useState<string[]>(p.keywords ?? []);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">Are these the people you're targeting?</h1>
      <p className="text-muted-foreground text-sm mb-6">We built these personas from your site. Add or remove titles, locations, and signal topics so the agent knows who to surface.</p>

      <div className="space-y-5">
        <div>
          <Label className="text-xs uppercase tracking-wide">Job Titles</Label>
          <div className="mt-2"><ChipList items={titles} onChange={setTitles} placeholder="Add a title (e.g. VP Sales)" /></div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide">Locations</Label>
          <div className="mt-2"><ChipList items={locations} onChange={setLocations} placeholder="Add a location" /></div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide">Keywords & topics ({keywords.length}/10)</Label>
          <div className="mt-2"><ChipList items={keywords} onChange={setKeywords} placeholder="Add a topic" max={10} /></div>
        </div>
      </div>

      <div className="flex gap-2 mt-8">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button className="flex-1" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            await persist({ data: { personas: { job_titles: titles, locations, keywords } } });
            onNext();
          } catch (e: any) { toast.error(e.message); }
          finally { setBusy(false); }
        }}>{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </Card>
  );
}

// ---------------- Step 5: firmographics ----------------
const SIZE_OPTIONS = ["2-10 employees", "11-50 employees", "51-200 employees", "201-500 employees", "500+ employees"];
const REV_OPTIONS = ["<$1M", "$1-5M", "$5-20M", "$20-100M", "$100M+"];
const FUND_OPTIONS = ["Bootstrapped", "Seed", "Series A", "Series B+", "Private Company", "Public"];

function MultiChoice({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(on ? value.filter(x => x !== o) : [...value, o])}
            className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-transparent hover:bg-muted"}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Step5Companies({ progress, onBack, onNext }: any) {
  const persist = useServerFn(saveFirmographics);
  const f = progress?.firmographics ?? {};
  const [sizes, setSizes] = useState<string[]>(f.company_sizes ?? []);
  const [industries, setIndustries] = useState<string[]>(f.industries ?? []);
  const [revenue, setRevenue] = useState<string[]>(f.revenue_bands ?? []);
  const [funding, setFunding] = useState<string[]>(f.funding_stages ?? []);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">Are these the companies you're targeting?</h1>
      <p className="text-muted-foreground text-sm mb-6">The firmographics your agent will match against. Tweak so the agent only surfaces people from the most relevant companies.</p>
      <div className="space-y-6">
        <div>
          <Label className="text-xs uppercase tracking-wide mb-2 block">Company Size</Label>
          <MultiChoice options={SIZE_OPTIONS} value={sizes} onChange={setSizes} />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide mb-2 block">Industries</Label>
          <ChipList items={industries} onChange={setIndustries} placeholder="Add an industry" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide mb-2 block">Revenue</Label>
          <MultiChoice options={REV_OPTIONS} value={revenue} onChange={setRevenue} />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide mb-2 block">Funding</Label>
          <MultiChoice options={FUND_OPTIONS} value={funding} onChange={setFunding} />
        </div>
      </div>
      <div className="flex gap-2 mt-8">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button className="flex-1" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            await persist({ data: { firmographics: { company_sizes: sizes, industries, revenue_bands: revenue, funding_stages: funding } } });
            onNext();
          } catch (e: any) { toast.error(e.message); }
          finally { setBusy(false); }
        }}>{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </Card>
  );
}

// ---------------- Step 6: signal brief ----------------
function Step6Brief({ progress, onBack, onNext }: any) {
  const persist = useServerFn(saveSignalBrief);
  const sb = progress?.signal_brief ?? {};
  const [competitors, setCompetitors] = useState<string[]>((sb.competitors ?? []).map((c: any) => typeof c === "string" ? c : `${c.name} (${c.domain})`));
  const [topics, setTopics] = useState<string[]>(sb.relevant_topics ?? []);
  const [pains, setPains] = useState<string[]>(sb.pain_points ?? []);
  const [signals, setSignals] = useState<string[]>(sb.buying_signals ?? []);
  const [busy, setBusy] = useState(false);
  const summary = progress?.scan_result?.summary ?? "";

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">Review your Signal Brief</h1>
      <p className="text-muted-foreground text-sm mb-6">These are the signals we'll use to explain why each new lead matters to your business. Edit before continuing.</p>

      {summary && (
        <div className="rounded-lg border bg-muted/30 p-4 mb-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Here's how we read your business</div>
          <p className="text-sm">{summary}</p>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <Label className="text-xs uppercase tracking-wide mb-2 block">Competitors ({competitors.length})</Label>
          <ChipList items={competitors} onChange={setCompetitors} placeholder="Competitor name" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide mb-2 block">Relevant topics ({topics.length})</Label>
          <ChipList items={topics} onChange={setTopics} placeholder="Topic buyers care about" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide mb-2 block">Pain points ({pains.length})</Label>
          <ChipList items={pains} onChange={setPains} placeholder="Full sentence pain point" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide mb-2 block">Buying signals ({signals.length})</Label>
          <ChipList items={signals} onChange={setSignals} placeholder="Full sentence buying signal" />
        </div>
      </div>

      <div className="flex gap-2 mt-8">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button className="flex-1" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            await persist({ data: { signal_brief: { competitors, relevant_topics: topics, pain_points: pains, buying_signals: signals } } });
            onNext();
          } catch (e: any) { toast.error(e.message); }
          finally { setBusy(false); }
        }}>{busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </Card>
  );
}

// ---------------- Step 7: connect APIs + sending email ----------------
function Step7Connect({ progress, onBack, onNext }: any) {
  const persist = useServerFn(saveSendingEmail);
  const [connected, setConnected] = useState<Record<string, boolean>>(progress?.connected_apis ?? {});
  const [busy, setBusy] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);


  // Check status on mount
  useEffect(() => {
    (async () => {
      try {
        const { getGmailStatus } = await import("@/lib/gmail.functions");
        const status: any = await getGmailStatus();
        if (status?.connected) {
          setConnected(c => ({ ...c, gmail: true }));
          setConnectedEmail(status.emailAddress ?? null);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const enableGmailSend = async () => {
    setBusy(true);
    try {
      const [{ connectAppUser }, { startGmailConnect, saveGmailConnection }] = await Promise.all([
        import("@/integrations/lovable/appUserConnectorClient"),
        import("@/lib/gmail.functions"),
      ]);
      const result = await connectAppUser({
        connectorId: "google_mail",
        gatewayBaseUrl: "https://connector-gateway.lovable.dev",
        start: async (targetOrigin) => await startGmailConnect({ data: { targetOrigin } }),
      });
      if (!result.success) { toast.error(result.error ?? "Gmail connect failed"); return; }
      if (!result.connectionAPIKey) {
        toast.message("Gmail connected without offline access — ask a workspace admin to enable offline access.");
        return;
      }
      const saved: any = await saveGmailConnection({ data: { connectionAPIKey: result.connectionAPIKey } });
      const email = saved?.emailAddress ?? null;
      setConnectedEmail(email);
      setConnected(c => ({ ...c, gmail: true }));
      if (email) await persist({ data: { provider: "gmail_app_user", address: email } });
      toast.success(email ? `Gmail connected: ${email}` : "Gmail connected");
    } catch (e: any) { toast.error(e?.message ?? "Gmail connect failed"); }
    finally { setBusy(false); }
  };



  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">Connect your channels</h1>
      <p className="text-muted-foreground text-sm mb-6">Wire up the accounts we'll use to surround your leads. You can add or change these anytime in Settings.</p>

      <div className="space-y-3">
        <ConnectRow
          icon={<Mail className="w-5 h-5" />}
          name="Gmail (send outreach)"
          desc={connected.gmail ? `Sending from ${connectedEmail ?? "your Gmail"}` : "Connect your Google account to send outreach from your Gmail"}
          connected={!!connected.gmail}
          disabled={busy}
          onClick={enableGmailSend}
        />
        <ConnectRow icon={<span className="font-bold text-sm">in</span>} name="LinkedIn API" desc="For DM outreach — add key in Settings > Social APIs (optional)" connected={false} disabled placeholder />
        <ConnectRow icon={<span className="font-bold text-sm">f</span>} name="Meta / Facebook API" desc="For DM outreach — add key in Settings > Social APIs (optional)" connected={false} disabled placeholder />
        <ConnectRow icon={<span className="font-bold text-sm">G</span>} name="Google Maps API" desc="For Discovery — add key in Settings > Discovery APIs (optional)" connected={false} disabled placeholder />
      </div>

      <p className="text-xs text-muted-foreground mt-4">All optional except email. Your team admin can add API keys in Settings later.</p>

      <div className="flex gap-2 mt-8">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button className="flex-1" onClick={onNext}>Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </Card>
  );
}

function ConnectRow({ icon, name, desc, connected, disabled, placeholder, onClick }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      {connected ? (
        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">Connected</Badge>
      ) : placeholder ? (
        <Badge variant="outline" className="text-xs">Add later</Badge>
      ) : (
        <Button size="sm" variant="outline" disabled={disabled} onClick={onClick}>Connect</Button>
      )}
    </div>
  );
}

// ---------------- Step 8: sample leads ----------------
function Step8Sample({ progress, onBack, onNext }: any) {
  const gen = useServerFn(generateSampleLeads);
  const [leads, setLeads] = useState<any[]>(progress?.sample_leads ?? []);
  const [busy, setBusy] = useState(false);
  const [refine, setRefine] = useState("");

  useEffect(() => {
    if (!leads.length) run();
    // eslint-disable-next-line
  }, []);

  async function run() {
    setBusy(true);
    try { const r = await gen(); setLeads(r.leads); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">Your first 5 leads</h1>
      <p className="text-muted-foreground text-sm mb-6">Preview leads built from your ICP. Confirm they fit — or tell us how to refine.</p>

      {busy && leads.length === 0 && (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Building your ICP preview…</div>
      )}

      <div className="space-y-2">
        {leads.map((l, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{l.name} <span className="text-muted-foreground font-normal">· {l.title}</span></div>
                <div className="text-xs text-muted-foreground">{l.company} · {l.industry} · {l.city}{l.state ? `, ${l.state}` : ""}</div>
              </div>
              <Badge variant="outline" className="text-xs">ICP match</Badge>
            </div>
            {l.reason && <p className="text-xs text-muted-foreground mt-2">{l.reason}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Label className="text-xs">Not quite right? Describe your ideal customer and we'll rebuild:</Label>
        <div className="flex gap-2 mt-2">
          <Input value={refine} onChange={(e) => setRefine(e.target.value)} placeholder="e.g. Owners of 5-star roofing companies in Texas doing $2M+" />
          <Button variant="outline" disabled={busy} onClick={run}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rebuild"}</Button>
        </div>
      </div>

      <div className="flex gap-2 mt-8">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button className="flex-1" onClick={onNext}>Looks right <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </Card>
  );
}

// ---------------- Step 9: trial start ----------------
function Step9Trial({ team, onBack }: any) {
  const finish = useServerFn(completeOnboarding);
  const nav = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("plans")
      .select("slug, name, price_monthly, trial_days, whop_checkout_url, features")
      .eq("is_active", true).order("sort_order")
      .then(({ data }) => { setPlans(data ?? []); if (data?.[1]) setSelected((data[1] as any).slug); });
  }, []);

  const plan = plans.find(p => p.slug === selected);

  const startTrial = async () => {
    setBusy(true);
    try {
      await finish();
      if (plan?.whop_checkout_url) window.open(plan.whop_checkout_url, "_blank");
      toast.success("Trial started — 100 records, 100 messages, 100 pipeline saves included");
      nav({ to: "/dashboard" });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-8">
      <h1 className="text-2xl font-bold mb-2">Start your 3-day free trial</h1>
      <p className="text-muted-foreground text-sm mb-6">Card auto-charges after 3 days. Cancel anytime from Settings. During the trial you get 100 discovery records, 100 messages, and 100 pipeline saves.</p>

      <div className="grid gap-3">
        {plans.map(p => (
          <button
            key={p.slug} type="button" onClick={() => setSelected(p.slug)}
            className={`text-left rounded-xl p-4 border-2 transition ${selected === p.slug ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-muted-foreground">${Number(p.price_monthly)}/mo after trial</div>
              </div>
              {p.trial_days > 0 && <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">{p.trial_days}-day free trial</Badge>}
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-8">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Button className="flex-1" disabled={!plan?.whop_checkout_url || busy} onClick={startTrial}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
          Add card & start trial
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">Secure checkout via Whop · Auto-charges ${Number(plan?.price_monthly ?? 0)}/mo after 3 days</p>
    </Card>
  );
}
