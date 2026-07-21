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
import { Radar, Play, Trash2, Plus } from "lucide-react";
import { listMonitors, saveMonitor, toggleMonitor, deleteMonitor, runMonitorNow } from "@/lib/monitors.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/monitors")({ component: Monitors });

function Monitors() {
  const list = useServerFn(listMonitors);
  const save = useServerFn(saveMonitor);
  const toggle = useServerFn(toggleMonitor);
  const del = useServerFn(deleteMonitor);
  const runNow = useServerFn(runMonitorNow);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["monitors"], queryFn: () => list() });

  const toggleMut = useMutation({
    mutationFn: (m: any) => toggle({ data: { id: m.id, status: m.status === "active" ? "paused" : "active" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitors"] }),
  });
  const runMut = useMutation({
    mutationFn: (id: string) => runNow({ data: { id } }),
    onSuccess: () => toast.success("Queued for next cron tick"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["monitors"] }); toast.success("Deleted"); },
  });

  return (
    <div className="container max-w-6xl py-8 px-4">
      <PageHeader title="Search Monitors" subtitle="Recurring Discovery searches that auto-add new leads">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New Monitor</Button></DialogTrigger>
          <NewMonitorDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["monitors"] }); }} saveFn={save} />
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Radar} title="No monitors yet" body="Create a monitor to keep discovering new leads on a schedule." />
      ) : (
        <div className="grid gap-3">
          {items.map((m: any) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{m.name}</h3>
                    <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
                    <Badge variant="outline">{m.frequency}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    "{m.keyword}"{m.location ? ` · ${m.location}` : ""} · auto-add ≥{m.auto_add_threshold} · {m.total_new_leads} new leads total
                  </div>
                  {m.next_run_at && <div className="text-xs text-muted-foreground mt-1">Next run: {new Date(m.next_run_at).toLocaleString()}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={m.status === "active"} onCheckedChange={() => toggleMut.mutate(m)} />
                  <Button variant="ghost" size="sm" onClick={() => runMut.mutate(m.id)} title="Run now">
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete monitor?")) delMut.mutate(m.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewMonitorDialog({ onDone, saveFn }: { onDone: () => void; saveFn: any }) {
  const [form, setForm] = useState({
    name: "", keyword: "", location: "", industry_filter: "",
    title_filters: ["Owner", "CEO", "Founder"] as string[],
    frequency: "weekly" as "weekly" | "monthly" | "manual",
    frequency_day: 1 as number | null,
    auto_add_threshold: 70,
    notification_prefs: { in_app: true, email: false, slack: false, skip_if_zero: true },
  });
  const mut = useMutation({
    mutationFn: () => saveFn({ data: { ...form, industry_filter: form.industry_filter || null } }),
    onSuccess: () => { toast.success("Monitor created"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Search Monitor</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="HVAC owners — Atlanta" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Keyword *</Label><Input value={form.keyword} onChange={e => setForm({ ...form, keyword: e.target.value })} placeholder="HVAC contractors" /></div>
          <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Atlanta, GA" /></div>
        </div>
        <div><Label>Industry filter</Label><Input value={form.industry_filter} onChange={e => setForm({ ...form, industry_filter: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Frequency</Label>
            <Select value={form.frequency} onValueChange={(v: any) => setForm({ ...form, frequency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Day {form.frequency === "weekly" ? "(0=Sun..6=Sat)" : "(1-28)"}</Label>
            <Input type="number" value={form.frequency_day ?? ""} onChange={e => setForm({ ...form, frequency_day: e.target.value ? parseInt(e.target.value) : null })} />
          </div>
        </div>
        <div><Label>Auto-add threshold (lead score)</Label><Input type="number" value={form.auto_add_threshold} onChange={e => setForm({ ...form, auto_add_threshold: parseInt(e.target.value) || 70 })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.name || !form.keyword}>
          {mut.isPending ? "Creating…" : "Create monitor"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
