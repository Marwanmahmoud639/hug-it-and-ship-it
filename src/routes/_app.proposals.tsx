import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Copy, ExternalLink, Trash2, Plus, Eye } from "lucide-react";
import { listProposals, createProposal, deleteProposal } from "@/lib/proposals.functions";
import { toast } from "sonner";
import { IS_AGENCY, BOOKING_URL} from "@/lib/brand";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/proposals")({ component: Proposals });

const PACKAGES = [
  { id: "starter", name: "Starter", price: 960, desc: "1 channel · 500 leads/mo" },
  { id: "growth", name: "Growth", price: 1500, desc: "2 channels · 1500 leads/mo" },
  { id: "scale", name: "Scale", price: 2500, desc: "3 channels · 3000 leads/mo" },
  { id: "enterprise", name: "Enterprise", price: 0, desc: "Custom — contact us" },
] as const;

function Proposals() {
  if (!IS_AGENCY) return <Navigate to="/dashboard" />;
  const list = useServerFn(listProposals);
  const create = useServerFn(createProposal);
  const del = useServerFn(deleteProposal);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["proposals"], queryFn: () => list() });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposals"] }); toast.success("Deleted"); },
  });

  return (
    <div className="container max-w-6xl py-8 px-4">
      <PageHeader title="Proposals" subtitle="Branded sales proposals for prospective clients">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New Proposal</Button></DialogTrigger>
          <NewProposalDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["proposals"] }); }} createFn={create} />
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={FileText} title="No proposals yet" body="Build your first branded proposal in under 60 seconds." />
      ) : (
        <div className="grid gap-3">
          {items.map((p: any) => {
            const url = `${window.location.origin}/proposal/${p.token}`;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{p.business_name}</h3>
                      <Badge variant="secondary">{p.status}</Badge>
                      <Badge variant="outline" className="text-xs">{p.package_selected}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      For {p.prospect_name} · {p.view_count} views{p.last_viewed_at ? ` · last ${new Date(p.last_viewed_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete proposal?")) delMut.mutate(p.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewProposalDialog({ onDone, createFn }: { onDone: () => void; createFn: any }) {
  const [form, setForm] = useState({
    prospect_name: "", business_name: "", industry: "", location: "",
    current_lead_method: "", monthly_lead_goal: "", notes: "",
    package_selected: "growth" as "starter" | "growth" | "scale" | "enterprise",
    guarantee_text: "", testimonial: "", cta_url: BOOKING_URL, expires_in_days: 14,
  });
  const mut = useMutation({
    mutationFn: () => createFn({ data: {
      ...form,
      monthly_lead_goal: form.monthly_lead_goal ? parseInt(form.monthly_lead_goal) : null,
      package_price: PACKAGES.find(p => p.id === form.package_selected)?.price || null,
      sample_leads: [],
    } }),
    onSuccess: () => { toast.success("Proposal created"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New Proposal</DialogTitle></DialogHeader>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Prospect name *</Label><Input value={form.prospect_name} onChange={e => setForm({ ...form, prospect_name: e.target.value })} /></div>
        <div><Label>Business name *</Label><Input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} /></div>
        <div><Label>Industry</Label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></div>
        <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
        <div><Label>Current lead method</Label><Input value={form.current_lead_method} onChange={e => setForm({ ...form, current_lead_method: e.target.value })} /></div>
        <div><Label>Monthly lead goal</Label><Input type="number" value={form.monthly_lead_goal} onChange={e => setForm({ ...form, monthly_lead_goal: e.target.value })} /></div>
      </div>

      <div>
        <Label className="mb-2 block">Package</Label>
        <div className="grid grid-cols-2 gap-2">
          {PACKAGES.map(p => (
            <button key={p.id} type="button" onClick={() => setForm({ ...form, package_selected: p.id })}
              className={`text-left p-3 border rounded-md hover:bg-accent ${form.package_selected === p.id ? "border-primary bg-accent" : ""}`}>
              <div className="font-medium">{p.name} {p.price > 0 && <span className="text-xs text-muted-foreground">${p.price}/mo</span>}</div>
              <div className="text-xs text-muted-foreground">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div><Label>Guarantee text</Label><Textarea rows={2} value={form.guarantee_text} onChange={e => setForm({ ...form, guarantee_text: e.target.value })} /></div>
      <div><Label>Testimonial</Label><Textarea rows={2} value={form.testimonial} onChange={e => setForm({ ...form, testimonial: e.target.value })} /></div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>CTA URL (booking link)</Label><Input type="url" placeholder={BOOKING_URL} value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })} /></div>
        <div><Label>Expires in days</Label><Input type="number" value={form.expires_in_days} onChange={e => setForm({ ...form, expires_in_days: parseInt(e.target.value) || 14 })} /></div>
      </div>

      <DialogFooter>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.prospect_name || !form.business_name}>
          {mut.isPending ? "Creating…" : "Create proposal"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
