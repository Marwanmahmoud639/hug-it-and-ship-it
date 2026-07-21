import { createFileRoute } from "@tanstack/react-router";
import { useLeadDrawer } from "@/components/contacts/lead-drawer-provider";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { SocialIcons } from "@/components/contacts/social-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, CheckCircle2, AlertCircle, Minus, Star, AlertTriangle, Linkedin, Instagram, Facebook, Mail, Phone, Users, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { CsvImportDialog } from "@/components/contacts/csv-import-dialog";
import { ContactsFilter, ActiveFilterChips, EMPTY_FILTER, applyContactFilter, type ContactFilterState } from "@/components/contacts/contacts-filter";

export const Route = createFileRoute("/_app/contacts")({ component: Contacts });

type Contact = {
  id: string; name: string; title: string | null; company: string | null;
  email: string | null; phone: string | null; lead_score: number;
  email_verified: boolean; phone_verified: boolean; source: string; tags: string[];
  linkedin_url: string | null; instagram_url: string | null; facebook_url: string | null;
  twitter_url: string | null; youtube_url: string | null;
  city: string | null; state: string | null; industry: string | null;
};

function Contacts() {
  const { team, role } = useAuth();
  const { openLead } = useLeadDrawer();
  const openContact = (id: string) => openLead(id);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState<ContactFilterState>(EMPTY_FILTER);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", title: "" });

  const load = async () => {
    if (!team?.id) return;
    const { data } = await supabase.from("contacts").select("*").eq("team_id", team.id).order("created_at", { ascending: false }).limit(500);
    setContacts((data ?? []) as Contact[]);
  };
  useEffect(() => { load(); }, [team?.id]);

  const create = async () => {
    if (!team?.id) return;
    const { error } = await supabase.from("contacts").insert({
      team_id: team.id, name: form.name, email: form.email || null, phone: form.phone || null,
      company: form.company || null, title: form.title || null,
      email_verified: !!form.email, phone_verified: !!form.phone, source: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Contact added");
    setOpen(false); setForm({ name: "", email: "", phone: "", company: "", title: "" });
    load();
  };

  const filtered = useMemo(() => {
    const k = debouncedQ.toLowerCase();
    const byText = contacts.filter(c =>
      !k || c.name.toLowerCase().includes(k) || c.email?.toLowerCase().includes(k) || c.company?.toLowerCase().includes(k),
    );
    return applyContactFilter(byText, filter);
  }, [contacts, debouncedQ, filter]);

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const clearSelection = () => setSelected({});

  const canEdit = role === "admin" || role === "manager";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto page-in pb-24">
        <PageHeader
          title="Contacts"
          subtitle="Your prospect database, enriched and verified."
        >
          <Badge variant="secondary" className="font-mono">
            {filtered.length === contacts.length
              ? `${contacts.length.toLocaleString()} total`
              : `${filtered.length.toLocaleString()} of ${contacts.length.toLocaleString()}`}
          </Badge>
          {canEdit && <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 mr-1" />Import CSV</Button>}
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Add Contact</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New contact</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    <div><Label>Company</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
                    <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                  </div>
                  <Button onClick={create} className="w-full">Save contact</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </PageHeader>

        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, email, company…" value={q} onChange={e => setQ(e.target.value)} className="pl-9 h-10" />
          </div>
          <ContactsFilter contacts={contacts} value={filter} onChange={setFilter} />
        </div>
        <ActiveFilterChips value={filter} onChange={setFilter} />

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            body="Add a contact manually, run a Discovery search, or import a CSV to begin."
            action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Add Contact</Button>}
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map(c => (
                <div key={c.id} onClick={() => openContact(c.id)} className="cursor-pointer">
                  <ContactCard c={c} />
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden shadow-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-10"></th>
                    <th className="text-left px-4 py-3">Score</th>
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Company</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Phone</th>
                    <th className="text-left px-4 py-3">Channels</th>
                    <th className="text-left px-4 py-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => openContact(c.id)}
                      className="border-t border-border/60 hover:bg-primary/[0.04] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!selected[c.id]}
                          onChange={e => setSelected(s => ({ ...s, [c.id]: e.target.checked }))}
                          className="rounded border-border"
                        />
                      </td>
                      <td className="px-4 py-3.5"><ScoreBadge score={c.lead_score} /></td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold">{c.name}</div>
                        {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                      </td>
                      <td className="px-4 py-3.5">{c.company || "—"}</td>
                      <td className="px-4 py-3.5">
                        {c.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="truncate max-w-[200px]">{c.email}</span>
                            <VerifyIcon verified={c.email_verified} kind="email" />
                          </span>
                        ) : <Minus className="w-3 h-3 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            {c.phone}
                            <VerifyIcon verified={c.phone_verified} kind="phone" />
                          </span>
                        ) : <Minus className="w-3 h-3 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3.5"><ChannelIcons c={c} /></td>
                      <td className="px-4 py-3.5">
                        <Badge variant="secondary" className="text-xs rounded-full">{c.source}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-4">
            <div className="bg-card border border-border rounded-xl shadow-card-hover px-4 py-2.5 flex items-center gap-3">
              <span className="text-sm font-semibold">{selectedCount} selected</span>
              <div className="h-5 w-px bg-border" />
              <Button size="sm" variant="ghost">Add to campaign</Button>
              <Button size="sm" variant="ghost">Add tag</Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">Delete</Button>
              <button onClick={clearSelection} className="ml-1 p-1 rounded hover:bg-accent" aria-label="Clear selection">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} onComplete={load} />
      </div>
    </TooltipProvider>
  );
}

function ContactCard({ c }: { c: Contact }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{c.name}</div>
          {c.title && <div className="text-xs text-muted-foreground truncate">{c.title}</div>}
          {c.company && <div className="text-xs truncate">{c.company}</div>}
        </div>
        <ScoreBadge score={c.lead_score} />
      </div>
      <div className="mt-3 space-y-1 text-xs">
        {c.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="w-3 h-3" />{c.email}</div>}
        {c.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3 h-3" />{c.phone}</div>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <ChannelIcons c={c} />
        <Badge variant="secondary" className="text-[10px] rounded-full">{c.source}</Badge>
      </div>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tier = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";
  const map = {
    hot: { bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", Icon: Star },
    warm: { bg: "bg-amber-500/15 text-amber-400 border-amber-500/30", Icon: Minus },
    cold: { bg: "bg-red-500/15 text-red-400 border-red-500/30", Icon: AlertTriangle },
  }[tier];
  return (
    <span className={cn("relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border overflow-hidden", map.bg)}>
      <span
        className="absolute inset-y-0 left-0 bg-current opacity-15"
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        aria-hidden
      />
      <map.Icon className="w-3 h-3 relative" />
      <span className="relative font-mono tabular-nums">{score}</span>
    </span>
  );
}

function VerifyIcon({ verified, kind }: { verified: boolean; kind: "email" | "phone" }) {
  const Tip = verified
    ? `Verified ${kind}`
    : `Unverified ${kind}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          {verified
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
        </span>
      </TooltipTrigger>
      <TooltipContent>{Tip}</TooltipContent>
    </Tooltip>
  );
}

function ChannelIcons({ c }: { c: Contact }) {
  return (
    <div className="flex items-center gap-2">
      <SocialIcons contact={c} size="sm" />
      {c.email && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span><Mail className="w-[14px] h-[14px] text-muted-foreground" /></span>
          </TooltipTrigger>
          <TooltipContent>Email on file</TooltipContent>
        </Tooltip>
      )}
      {c.phone && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span><Phone className="w-[14px] h-[14px] text-emerald-500" /></span>
          </TooltipTrigger>
          <TooltipContent>Phone on file</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
