import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/ui-bits";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { listMappedContacts, geocodeContacts } from "@/lib/areas.functions";
import { AreasMap } from "@/components/areas/AreasMap";
import type { MapContact } from "@/components/areas/LeadPinCard";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/areas")({ component: AreasPage });

function AreasPage() {
  const fetchList = useServerFn(listMappedContacts);
  const runGeocode = useServerFn(geocodeContacts);
  const qc = useQueryClient();
  const { team } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["areas", "contacts"],
    queryFn: () => fetchList({}),
  });

  const contacts = (data?.contacts ?? []) as MapContact[];
  const needGeocode = data?.needGeocode ?? [];

  const [geocoding, setGeocoding] = useState(0);
  const [geocodingTotal, setGeocodingTotal] = useState(0);
  useEffect(() => {
    if (!needGeocode.length) return;
    let cancelled = false;
    (async () => {
      const ids = [...needGeocode];
      setGeocodingTotal(ids.length);
      setGeocoding(ids.length);
      while (ids.length && !cancelled) {
        const batch = ids.splice(0, 25);
        try { await runGeocode({ data: { ids: batch } }); } catch {}
        setGeocoding(ids.length);
      }
      if (!cancelled) {
        setGeocodingTotal(0);
        qc.invalidateQueries({ queryKey: ["areas", "contacts"] });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needGeocode.length]);

  // Realtime
  useEffect(() => {
    if (!team?.id) return;
    const channel = supabase
      .channel(`areas-${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts", filter: `team_id=eq.${team.id}` },
        () => qc.invalidateQueries({ queryKey: ["areas", "contacts"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [team?.id, qc]);

  // Filters
  const [type, setType] = useState("all");
  const [score, setScore] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"pins" | "heatmap">("pins");

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = search.toLowerCase().trim();
    return contacts.filter((c) => {
      if (c.lat == null || c.lng == null) return false;
      const isBusiness = !!c.company;
      if (type === "business" && !isBusiness) return false;
      if (type === "individual" && isBusiness) return false;
      if (score === "gt70" && c.lead_score <= 70) return false;
      if (score === "gt50" && c.lead_score <= 50) return false;
      if (status !== "all" && (c.status ?? "new") !== status) return false;
      if (range !== "all") {
        const ms = now - new Date(c.created_at).getTime();
        const days = ms / 86400000;
        if (range === "week" && days > 7) return false;
        if (range === "month" && days > 30) return false;
      }
      if (q) {
        const hay = [c.name, c.company, c.city, c.state, c.email, c.phone].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, type, score, status, range, search]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Areas" subtitle="Where your leads are on the map" />

      <div className="px-3 sm:px-4 pb-2 sm:pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible border-b border-border">
        <Input
          placeholder="Search city, state, name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-44 sm:w-56 shrink-0"
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-32 sm:w-36 shrink-0"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={score} onValueChange={setScore}>
          <SelectTrigger className="w-32 sm:w-36 shrink-0"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scores</SelectItem>
            <SelectItem value="gt70">Score &gt; 70</SelectItem>
            <SelectItem value="gt50">Score &gt; 50</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32 sm:w-36 shrink-0"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-32 sm:w-36 shrink-0"><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
        <div className="sm:ml-auto flex gap-1 rounded-md border border-border p-0.5 shrink-0">
          <Button size="sm" variant={view === "pins" ? "default" : "ghost"} onClick={() => setView("pins")} className="h-7 px-3 text-xs">Pins</Button>
          <Button size="sm" variant={view === "heatmap" ? "default" : "ghost"} onClick={() => setView("heatmap")} className="h-7 px-3 text-xs">Heatmap</Button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[60vh] sm:min-h-[500px]">
        {isLoading ? (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground">
            <div className="flex items-center gap-2"><MapPin className="animate-pulse" size={18} /> Loading map…</div>
          </div>
        ) : (
          <AreasMap contacts={filtered} viewMode={view} />
        )}

        {/* Geocoding progress banner */}
        {geocoding > 0 && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full border border-border bg-card/95 backdrop-blur px-4 py-1.5 text-xs shadow-lg flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} />
            Geocoding {geocodingTotal - geocoding + 1} of {geocodingTotal}…
          </div>
        )}

        {/* Empty: no contacts at all */}
        {!isLoading && contacts.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center z-10">
            <div className="rounded-lg border border-border bg-card/95 backdrop-blur px-6 py-5 text-center shadow-lg max-w-sm">
              <MapPin className="mx-auto mb-2 text-muted-foreground" size={28} />
              <div className="font-semibold">No contacts on map yet</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Run a Discovery search to find leads. They'll appear here once geocoded.
              </div>
            </div>
          </div>
        )}

        {/* Empty: contacts exist but none geocoded yet */}
        {!isLoading && filtered.length === 0 && contacts.length > 0 && geocoding > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center z-10">
            <div className="rounded-lg border border-border bg-card/95 backdrop-blur px-6 py-5 text-center shadow-lg max-w-sm">
              <Loader2 className="mx-auto mb-2 animate-spin text-muted-foreground" size={28} />
              <div className="font-semibold">Geocoding in progress</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {contacts.length} contacts found. Fetching coordinates…
              </div>
            </div>
          </div>
        )}

        {/* Empty: filters hide everything */}
        {!isLoading && filtered.length === 0 && contacts.length > 0 && geocoding === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center z-10">
            <div className="rounded-lg border border-border bg-card/95 backdrop-blur px-6 py-5 text-center shadow-lg max-w-sm">
              <div className="font-semibold">No leads match your filters</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Try clearing filters or widening your search.
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="hidden sm:block absolute bottom-4 left-4 z-10 rounded-lg border border-border bg-card/95 backdrop-blur p-3 text-xs space-y-1.5 shadow-lg">
          <div className="font-semibold mb-1">Legend</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Business</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> Individual</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> High score (80+)</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" /> Contacted</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#6b7280]" /> Closed</div>
        </div>

        {/* Counter */}
        <div className="absolute bottom-4 right-4 z-10 rounded-lg border border-border bg-card/95 backdrop-blur px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs shadow-lg">
          Showing {filtered.length.toLocaleString()} lead{filtered.length === 1 ? "" : "s"}
          {geocoding > 0 && <span className="ml-2 text-muted-foreground">· geocoding {geocoding}…</span>}
        </div>
      </div>
    </div>
  );
}
