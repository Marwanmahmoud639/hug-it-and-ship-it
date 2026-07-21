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
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Share2, Copy, ExternalLink, Trash2, Plus } from "lucide-react";
import { listPortals, createPortal, togglePortal, deletePortal } from "@/lib/portals.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/portals")({ component: Portals });

function Portals() {
  const list = useServerFn(listPortals);
  const create = useServerFn(createPortal);
  const toggle = useServerFn(togglePortal);
  const del = useServerFn(deletePortal);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["portals"], queryFn: () => list() });

  const toggleMut = useMutation({
    mutationFn: (p: any) => toggle({ data: { id: p.id, active: !p.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portals"] }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portals"] }); toast.success("Deleted"); },
  });

  return (
    <div className="container max-w-6xl py-8 px-4">
      <PageHeader title="Client Portals" subtitle="Shareable read-only branded links for your clients">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New Portal</Button></DialogTrigger>
          <NewPortalDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["portals"] }); }} createFn={create} />
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Share2} title="No portals yet" body="Create your first shareable client portal." />
      ) : (
        <div className="grid gap-3">
          {items.map((p: any) => {
            const url = `${window.location.origin}/portal/${p.token}`;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Active" : "Off"}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.filter_type}: <code>{p.filter_value}</code> · {p.date_range} · {p.view_count} views
                      {p.last_viewed_at ? ` · last ${new Date(p.last_viewed_at).toLocaleDateString()}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate font-mono">{url}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={p.active} onCheckedChange={() => toggleMut.mutate(p)} />
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete portal?")) delMut.mutate(p.id); }}>
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

function NewPortalDialog({ onDone, createFn }: { onDone: () => void; createFn: any }) {
  const [form, setForm] = useState({
    name: "", filter_type: "tag" as "tag" | "stage", filter_value: "",
    date_range: "30d" as "7d" | "30d" | "all", expires_in_days: null as number | null,
  });
  const mut = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => { toast.success("Portal created"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Client Portal</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Portal name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Client A — Q2" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Filter by</Label>
            <Select value={form.filter_type} onValueChange={(v: any) => setForm({ ...form, filter_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tag">Tag</SelectItem>
                <SelectItem value="stage">Pipeline stage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Value *</Label><Input value={form.filter_value} onChange={e => setForm({ ...form, filter_value: e.target.value })} placeholder={form.filter_type === "tag" ? "vip-client" : "Qualified"} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date range</Label>
            <Select value={form.date_range} onValueChange={(v: any) => setForm({ ...form, date_range: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Expires in days</Label>
            <Input type="number" placeholder="Never" value={form.expires_in_days ?? ""} onChange={e => setForm({ ...form, expires_in_days: e.target.value ? parseInt(e.target.value) : null })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.name || !form.filter_value}>
          {mut.isPending ? "Creating…" : "Create portal"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
