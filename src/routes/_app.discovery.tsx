import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startDiscovery, startIndividualDiscovery, cancelSearch, cancelIndividualSearch } from "@/lib/discovery.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState } from "@/components/app-shell/ui-bits";
import { ResultsMap } from "@/components/discovery/ResultsMap";
import { ProgressActivityLog } from "@/components/discovery/ProgressActivityLog";
import { KeywordAutocomplete } from "@/components/discovery/KeywordAutocomplete";
import { LocationAutocomplete } from "@/components/discovery/LocationAutocomplete";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DISCOVERY_INDUSTRIES } from "@/lib/discovery-industries";
import { toast } from "sonner";
import { Loader2, Check, X, ExternalLink, Zap, Radar, RotateCw, Users, Plus, XCircle, CheckCircle2, TrendingUp, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiscoveryCapBanner } from "@/components/app-shell/discovery-cap-banner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/discovery")({
  component: () => (
    <Tabs defaultValue="businesses" className="h-full flex flex-col">
      <div className="border-b border-border bg-card/40 px-4 md:px-6 pt-3 space-y-3">
        <DiscoveryCapBanner />
        <TabsList>
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
          <TabsTrigger value="individuals">Individuals</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="businesses" className="flex-1 m-0 overflow-hidden"><DiscoveryPage /></TabsContent>
      <TabsContent value="individuals" className="flex-1 m-0 overflow-hidden"><IndividualsTab /></TabsContent>
    </Tabs>
  ),
});

const STEP_LABELS: Record<string, string> = {
  business: "1. Business Discovery",
  decisionmakers: "2. Decision-Maker Extraction",
  social: "3. Social Profile Discovery",
  skiptrace: "4. Skip Trace",
  verify: "5. Verification",
  score: "6. Lead Scoring + Auto-Pipeline",
};
const STEP_ORDER = ["business", "decisionmakers", "social", "skiptrace", "verify", "score"];
const TITLES = ["Owner", "CEO", "Founder", "Co-Founder", "President", "C-Suite"];
const TERMINAL_STATUSES = ["complete", "partial", "failed", "cancelled"];
const EXAMPLES = [
  "digital marketing agencies", "roofing contractors", "law firms",
  "accounting firms", "IT service companies", "landscaping businesses",
];

function statusBadgeClass(s: string) {
  if (s === "complete") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "running") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (s === "failed") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function DiscoveryPage() {
  const qc = useQueryClient();
  const start = useServerFn(startDiscovery);
  const cancel = useServerFn(cancelSearch);
  const { team } = useAuth();
  const teamNiche = (team as any)?.default_industry as string | undefined;
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState<string>(teamNiche || "");
  const [titles, setTitles] = useState<string[]>(TITLES);
  useEffect(() => { if (teamNiche && !industry) setIndustry(teamNiche); }, [teamNiche]);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => start({ data: { keyword, location, industry: industry || null, titles } }),
    onSuccess: (res) => {
      setActiveSearchId(res.searchId);
      toast.success("Discovery started");
    },
    onError: (e: any) => toast.error(e.message || "Failed to start"),
  });

  const { data: search } = useQuery({
    queryKey: ["search", activeSearchId],
    queryFn: async () => {
      if (!activeSearchId) return null;
      const { data } = await supabase.from("searches").select("*").eq("id", activeSearchId).single();
      return data;
    },
    enabled: !!activeSearchId,
    // Keep polling while the search is in flight; stop once it reaches a
    // terminal state so finished searches don't poll every 2s forever.
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status as string | undefined;
      return status && TERMINAL_STATUSES.includes(status) ? false : 2000;
    },
  });

  // Once the parent search is terminal, the step/result polling can stop too.
  const searchIsTerminal = !!search?.status && TERMINAL_STATUSES.includes(search.status as string);

  const { data: steps = [] } = useQuery({
    queryKey: ["search_steps", activeSearchId],
    queryFn: async () => {
      if (!activeSearchId) return [];
      const { data } = await supabase.from("search_steps").select("*").eq("search_id", activeSearchId);
      return data || [];
    },
    enabled: !!activeSearchId,
    refetchInterval: searchIsTerminal ? false : 2000,
  });

  const { data: results = [] } = useQuery({
    queryKey: ["search_results", activeSearchId],
    queryFn: async () => {
      if (!activeSearchId) return [];
      const { data } = await supabase
        .from("search_results")
        .select("*, contact:contacts(*)")
        .eq("search_id", activeSearchId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!activeSearchId,
    refetchInterval: searchIsTerminal ? false : 2000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["search_history"],
    queryFn: async () => {
      const { data } = await supabase.from("searches").select("*").order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
  });

  // Show summary popup when search transitions to complete/partial/failed
  useEffect(() => {
    if (!search) return;
    const prev = prevStatusRef.current;
    const curr = search.status as string;
    if (prev === "running" && (curr === "complete" || curr === "partial" || curr === "failed")) {
      setSummaryOpen(true);
    }
    prevStatusRef.current = curr;
  }, [search?.status]);

  useEffect(() => {
    if (!activeSearchId) return;
    const ch = supabase
      .channel(`discovery-${activeSearchId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "search_results", filter: `search_id=eq.${activeSearchId}` },
        () => qc.invalidateQueries({ queryKey: ["search_results", activeSearchId] }))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "search_steps", filter: `search_id=eq.${activeSearchId}` },
        () => qc.invalidateQueries({ queryKey: ["search_steps", activeSearchId] }))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "searches", filter: `id=eq.${activeSearchId}` },
        () => qc.invalidateQueries({ queryKey: ["search", activeSearchId] }))
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "search_activity", filter: `search_id=eq.${activeSearchId}` },
        () => qc.invalidateQueries({ queryKey: ["search_activity", activeSearchId] }))
      .subscribe((status) => {
        console.log("Discovery channel status:", status);
      });
    return () => { supabase.removeChannel(ch); };
  }, [activeSearchId, qc]);


  const completedSteps = steps.filter((s: any) => s.status === "complete").length;
  const progress = Math.round((completedSteps / 6) * 100);
  const isComplete = search?.status === "complete" || search?.status === "partial";

  const toggleTitle = (t: string) =>
    setTitles(ts => ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]);

  const avgScore = Math.round(Number(search?.avg_lead_score || 0));

  return (
    <>
    <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Discovery Complete
          </DialogTitle>
          <DialogDescription>
            Search for "{search?.keyword}"{search?.location ? ` in ${search.location}` : ""} finished.
            All verified leads were auto-added to your contacts and pipeline as <strong>New Lead</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          {[
            { label: "Businesses Found", value: search?.businesses_found ?? 0, icon: "🏢" },
            { label: "Decision Makers", value: search?.decision_makers_found ?? 0, icon: "👤" },
            { label: "Verified Emails", value: search?.verified_emails ?? 0, icon: "📧" },
            { label: "Verified Phones", value: search?.verified_phones ?? 0, icon: "📞" },
            { label: "Auto-Added to Pipeline", value: search?.auto_added_to_pipeline ?? 0, icon: "⚡" },
            { label: "Avg Lead Score", value: `${avgScore}/100`, icon: "🎯" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-muted/40 rounded-xl p-3 space-y-1">
              <div className="text-lg">{icon}</div>
              <div className="text-xl font-bold tabular-nums" style={{ fontFamily: "Sora" }}>{value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        {((search as any)?.duplicates_count ?? 0) > 0 && (
          <div className="text-xs bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 space-y-1.5">
            <div className="font-medium text-amber-600 dark:text-amber-400">
              Skipped {(search as any).duplicates_count} duplicate{(search as any).duplicates_count === 1 ? "" : "s"} already in your contacts
            </div>
            <ul className="text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
              {((search as any).duplicates as Array<{ name: string; reason: string; existing_contact_id: string }>)?.slice(0, 8).map((d, i) => (
                <li key={i} className="truncate">• {d.name} <span className="opacity-60">({d.reason})</span></li>
              ))}
            </ul>
            <div className="text-[10px] text-muted-foreground/70">Discovery leads are kept for 90 days, then auto-cleared so the same business can be re-scraped.</div>
          </div>
        )}
        {avgScore > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            Leads with verified email or phone were auto-added. No bounced emails included.
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" asChild className="flex-1">
            <Link to="/contacts">View Contacts</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link to="/pipeline">View Pipeline <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] h-full page-in">
      {/* LEFT */}
      <div className="bg-card/40 border-r border-border p-4 md:p-6 space-y-6 overflow-y-auto">
        <Card className="p-6 rounded-2xl space-y-5 card-hover-lift">
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "Sora" }}>Discovery Search</h2>
            <p className="text-xs text-muted-foreground">Find decision-makers across the web in one pass.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Keyword</Label>
            <KeywordAutocomplete
              value={keyword}
              onChange={setKeyword}
              placeholder="cash buyers Texas, real estate wholesalers Florida"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Location</Label>
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              placeholder="Austin, TX  or  New York, NY  or  Florida"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Industry</Label>
            <Select value={industry || "__any"} onValueChange={(v) => setIndustry(v === "__any" ? "" : v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Any industry" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__any">Any industry (no filter)</SelectItem>
                {DISCOVERY_INDUSTRIES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Narrows results so a "real estate companies" search doesn't return tire shops or unrelated niches.
            </p>
          </div>


          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Target Decision Makers</Label>
            <div className="grid grid-cols-3 gap-2">
              {TITLES.map(t => {
                const on = titles.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTitle(t)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150 active:scale-[0.97]",
                      on
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            className="w-full h-12 text-sm shadow-primary-glow"
            disabled={!keyword || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Search
          </Button>
        </Card>

        {activeSearchId && (
          <ProgressActivityLog searchId={activeSearchId} searchStatus={search?.status} />
        )}

        {activeSearchId && (
          <Card className="p-5 space-y-3 card-hover-lift">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ fontFamily: "Sora" }}>Progress</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    qc.invalidateQueries({ queryKey: ["search", activeSearchId] });
                    qc.invalidateQueries({ queryKey: ["search_results", activeSearchId] });
                    qc.invalidateQueries({ queryKey: ["search_steps", activeSearchId] });
                    qc.invalidateQueries({ queryKey: ["search_activity", activeSearchId] });
                  }}
                  className="gap-2 h-7"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Refresh
                </Button>
                {search?.status === "running" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      await cancel({ data: { searchId: activeSearchId } });
                      toast.success("Search cancelled");
                    }}
                    className="gap-2 h-7"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Stop
                  </Button>
                )}
                <Badge className={cn("border", statusBadgeClass(search?.status || "pending"))}>{search?.status || "starting"}</Badge>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <ul className="space-y-2 text-sm">
              {STEP_ORDER.map(name => {
                const s = steps.find((x: any) => x.step === name);
                const status = s?.status || "pending";
                return (
                  <li key={name} className="flex items-start gap-2">
                    {status === "running" && <Loader2 className="size-4 animate-spin text-primary mt-0.5" />}
                    {status === "complete" && <Check className="size-4 text-emerald-500 mt-0.5" />}
                    {status === "failed" && <X className="size-4 text-destructive mt-0.5" />}
                    {status === "pending" && <span className="size-4 rounded-full border border-muted-foreground/30 mt-0.5" />}
                    <div className="flex-1">
                      <div>{STEP_LABELS[name]}</div>
                      {s?.sub_status && <div className="text-xs text-muted-foreground">{s.sub_status}</div>}
                      {(s?.sources_success?.length || s?.sources_failed?.length) ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.sources_success?.map((x: string) => <Badge key={x} variant="outline" className="text-[10px] text-emerald-500">{x} ✓</Badge>)}
                          {s.sources_failed?.map((x: string) => <Badge key={x} variant="outline" className="text-[10px] text-destructive">{x} ✗</Badge>)}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card className="p-5">
          <h3 className="font-semibold mb-3" style={{ fontFamily: "Sora" }}>Search History</h3>
          <div className="space-y-2 max-h-96 overflow-auto">
            {history.length === 0 && <div className="text-sm text-muted-foreground">No searches yet.</div>}
            {history.map((h: any) => (
              <button
                key={h.id}
                onClick={() => setActiveSearchId(h.id)}
                className="group w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/30 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate text-sm">{h.keyword}</span>
                  <Badge className={cn("border text-[10px]", statusBadgeClass(h.status))}>{h.status}</Badge>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-muted-foreground truncate">
                    {h.location ? `${h.location} · ` : ""}{new Date(h.created_at).toLocaleDateString()}
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <RotateCw className="w-3.5 h-3.5 text-primary" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* RIGHT */}
      <div className="p-4 md:p-6 space-y-4 overflow-y-auto">
        {search && (
          <Card className="p-5 card-hover-lift">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold" style={{ fontFamily: "Sora" }}>Search: "{search.keyword}"</h3>
              <Link to="/pipeline"><Button size="sm" variant="outline">View Pipeline <ExternalLink className="size-3 ml-1" /></Button></Link>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Stat label="Businesses" value={search.businesses_found} />
              <Stat label="Decision Makers" value={search.decision_makers_found} />
              <Stat label="Verified Emails" value={search.verified_emails} />
              <Stat label="Verified Phones" value={search.verified_phones} />
              <Stat label="Avg Score" value={Number(search.avg_lead_score || 0).toFixed(0)} />
              <Stat label="Auto-Added" value={search.auto_added_to_pipeline} />
            </div>
          </Card>
        )}

        {search && (
          <ResultsMap centerLat={(search as any).map_center_lat} centerLng={(search as any).map_center_lng} />
        )}

        {isComplete && results.length === 0 && (
          <div className="p-6 text-center text-muted-foreground border border-border rounded-xl">
            <p className="font-medium mb-1">No results found</p>
            <p className="text-sm">
              {search?.sources_failed && Object.keys(search.sources_failed as Record<string, string>).length > 0
                ? `${Object.keys(search.sources_failed as Record<string, string>).length} sources failed. Check your API keys in Settings → APIs.`
                : "Try a different keyword or location."}
            </p>
            {search?.sources_failed && Object.keys(search.sources_failed as Record<string, string>).length > 0 && (
              <div className="mt-3 text-xs text-left bg-muted/30 rounded p-3 space-y-1">
                {Object.entries(search.sources_failed as Record<string, string>).map(([source, error]) => (
                  <div key={source}>
                    <span className="text-red-400">✗ {source}:</span> {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!search && (
          <EmptyState
            icon={Radar}
            title="Enter a keyword to start discovering leads"
            body="C4D scans business directories, social, and skip-trace sources in one pass."
            size="lg"
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => setKeyword(ex)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            }
          />
        )}

        {search && (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Score</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Sources</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Waiting for results…</td></tr>
                )}
                {results.map((r: any) => {
                  const c = r.contact;
                  if (!c) return null;
                  const score = c.lead_score || 0;
                  const color = score >= 70 ? "bg-emerald-500/15 text-emerald-400"
                    : score >= 40 ? "bg-amber-500/15 text-amber-400"
                    : "bg-red-500/15 text-red-400";
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-accent/30 transition-colors">
                      <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{score}</span></td>
                      <td className="p-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.title}</div>
                      </td>
                      <td className="p-3">
                        <div>{c.company}</div>
                        <div className="text-xs text-muted-foreground">{c.industry}</div>
                      </td>
                      <td className="p-3 text-xs">
                        {c.email ? <span className={c.email_verified ? "text-emerald-500" : "text-amber-500"}>{c.email} {c.email_verified ? "✓" : "⚠"}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-xs">{c.phone || <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.verification_sources || []).map((s: string) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                        </div>
                      </td>
                      <td className="p-3">{r.auto_added_to_pipeline && <Badge className="text-[10px]">Added ✓</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "Sora" }}>{value}</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-widest">{label}</div>
    </div>
  );
}

// ============== Individuals Tab (inlined) ==============

const IND_ROLES_PRESET = ["Owner", "CEO", "Founder", "Director", "Manager", "Partner"];
const IND_PLATFORMS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "reddit", label: "Reddit" },
  { id: "google", label: "Google" },
] as const;

function indStatusClass(s: string) {
  if (s === "complete") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "running") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (s === "partial") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (s === "failed") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (s === "cancelled") return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function IndividualsTab() {
  const qc = useQueryClient();
  const start = useServerFn(startIndividualDiscovery);
  const cancel = useServerFn(cancelIndividualSearch);
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["linkedin", "facebook", "google"]);
  const [roles, setRoles] = useState<string[]>(["Owner", "CEO", "Founder"]);
  const [customRole, setCustomRole] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => start({ data: { keyword, location, platforms: platforms as any, roles } }),
    onSuccess: (res) => {
      setActiveId(res.searchId);
      toast.success("Individual discovery started");
    },
    onError: (e: any) => toast.error(e.message || "Failed to start"),
  });

  const { data: search } = useQuery({
    queryKey: ["ind-search", activeId],
    queryFn: async () => {
      if (!activeId) return null;
      const { data } = await supabase.from("individual_searches").select("*").eq("id", activeId).single();
      return data;
    },
    enabled: !!activeId,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status as string | undefined;
      return status && TERMINAL_STATUSES.includes(status) ? false : 2000;
    },
  });

  const indIsTerminal = !!search?.status && TERMINAL_STATUSES.includes(search.status as string);

  const { data: results = [] } = useQuery({
    queryKey: ["ind-results", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      const { data } = await supabase
        .from("individual_search_results")
        .select("*")
        .eq("search_id", activeId)
        .order("confidence_score", { ascending: false });
      return data || [];
    },
    enabled: !!activeId,
    refetchInterval: indIsTerminal ? false : 2000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["ind-history"],
    queryFn: async () => {
      const { data } = await supabase.from("individual_searches").select("*").order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
  });

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`ind-${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "individual_search_results", filter: `search_id=eq.${activeId}` },
        () => qc.invalidateQueries({ queryKey: ["ind-results", activeId] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "individual_searches", filter: `id=eq.${activeId}` },
        () => qc.invalidateQueries({ queryKey: ["ind-search", activeId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, qc]);

  const togglePlat = (id: string) =>
    setPlatforms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleRole = (r: string) =>
    setRoles(rs => rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] h-full">
      <div className="bg-card/40 border-r border-border p-4 md:p-6 space-y-6 overflow-y-auto">
        <Card className="p-6 rounded-2xl space-y-5">
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "Sora" }}>Individual Discovery</h2>
            <p className="text-xs text-muted-foreground">Find people by role across LinkedIn, Facebook, Reddit, and Google.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Keyword / Role</Label>
            <KeywordAutocomplete value={keyword} onChange={setKeyword} placeholder="wholesaler, cash buyer" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Location</Label>
            <LocationAutocomplete value={location} onChange={setLocation} placeholder="Austin, TX  or  Florida" />
          </div>


          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Platforms</Label>
            <div className="grid grid-cols-2 gap-2">
              {IND_PLATFORMS.map(p => {
                const on = platforms.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => togglePlat(p.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium border transition-all active:scale-[0.97]",
                      on ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}>{p.label}</button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Target Roles</Label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {IND_ROLES_PRESET.map(r => {
                const on = roles.includes(r);
                return (
                  <button key={r} type="button" onClick={() => toggleRole(r)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium border transition-all active:scale-[0.97]",
                      on ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}>{r}</button>
                );
              })}
            </div>
            {/* Custom tags added by user */}
            {roles.filter(r => !IND_ROLES_PRESET.includes(r)).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {roles.filter(r => !IND_ROLES_PRESET.includes(r)).map(r => (
                  <span key={r} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/15 text-primary border border-primary/30">
                    {r}
                    <button type="button" onClick={() => toggleRole(r)} className="hover:text-destructive">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Add custom role…"
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && customRole.trim()) {
                    const r = customRole.trim();
                    if (!roles.includes(r)) setRoles(rs => [...rs, r]);
                    setCustomRole("");
                  }
                }}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                disabled={!customRole.trim()}
                onClick={() => {
                  const r = customRole.trim();
                  if (r && !roles.includes(r)) setRoles(rs => [...rs, r]);
                  setCustomRole("");
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <Button className="w-full h-12 text-sm shadow-primary-glow"
            disabled={!keyword || platforms.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Find Individuals
          </Button>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3" style={{ fontFamily: "Sora" }}>Search History</h3>
          <div className="space-y-2 max-h-96 overflow-auto">
            {history.length === 0 && <div className="text-sm text-muted-foreground">No searches yet.</div>}
            {history.map((h: any) => (
              <button key={h.id} onClick={() => setActiveId(h.id)}
                className="group w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/30 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold truncate text-sm">{h.keyword}</span>
                  <Badge className={cn("border text-[10px]", indStatusClass(h.status))}>{h.status}</Badge>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-muted-foreground truncate">
                    {h.location ? `${h.location} · ` : ""}{new Date(h.created_at).toLocaleDateString()}
                  </div>
                  <RotateCw className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="p-4 md:p-6 space-y-4 overflow-y-auto">
        {search && (
          <>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold" style={{ fontFamily: "Sora" }}>Search: "{search.keyword}"</h3>
                  <Badge className={cn("border", indStatusClass(search.status))}>{search.status}</Badge>
                </div>
                {search.status === "running" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      await cancel({ data: { searchId: activeId } });
                      toast.success("Search cancelled");
                    }}
                    className="gap-2 h-7"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Stop Search
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <Stat label="Individuals" value={search.individuals_found} />
                <Stat label="Verified" value={search.verified_count} />
                <Stat label="Platforms" value={(search.platforms || []).length} />
              </div>
            </Card>

            <ResultsMap centerLat={(search as any).map_center_lat} centerLng={(search as any).map_center_lng} />
          </>
        )}

        {!search && (
          <Card className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1" style={{ fontFamily: "Sora" }}>Search to find individuals</h3>
            <p className="text-sm text-muted-foreground">Pick platforms and roles, then run a discovery.</p>
          </Card>
        )}

        {search && (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Score</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Sources</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Waiting for results…</td></tr>
                )}
                {results.map((r: any) => {
                  const score = r.confidence_score || 0;
                  const color = score >= 60 ? "bg-emerald-500/15 text-emerald-400"
                    : score >= 40 ? "bg-amber-500/15 text-amber-400"
                    : "bg-red-500/15 text-red-400";
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                      <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{score}</span></td>
                      <td className="p-3 font-medium">{r.full_name}</td>
                      <td className="p-3 text-xs">{r.role || "—"}</td>
                      <td className="p-3 text-xs">{r.company_name || "—"}</td>
                      <td className="p-3 text-xs">
                        {r.email && <div className="text-emerald-500">{r.email}</div>}
                        {r.phone && <div>{r.phone}</div>}
                        {!r.email && !r.phone && <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(r.sources || []).map((s: string) => (
                            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
