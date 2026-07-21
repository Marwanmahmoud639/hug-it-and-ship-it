import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, ArrowRightLeft, Users, Database, Megaphone, Palette, UserCog } from "lucide-react";
import { toast } from "sonner";
import { getAgencyRollup, createSubAccount, switchTeam, updateSubAccountBranding, listSubAccountMembers, assignSubAccountAdmin, type AgencyRollup } from "@/lib/teams.functions";
import { useServerFn as _useServerFn } from "@tanstack/react-start";
import { DISCOVERY_INDUSTRIES } from "@/lib/discovery-industries";

export const Route = createFileRoute("/_app/agency")({ component: AgencyPage });

function AgencyPage() {
  const { team, role, isSuperAdmin, refresh, loading } = useAuth();
  const [data, setData] = useState<AgencyRollup | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"starter" | "growth" | "agency">("starter");
  const [adminEmail, setAdminEmail] = useState("");
  const [primary, setPrimary] = useState("#2563EB");
  const [secondary, setSecondary] = useState("#8B5CF6");
  const [whiteLabelName, setWhiteLabelName] = useState("");
  const [monthlyRecords, setMonthlyRecords] = useState<number>(1000);
  const [seats, setSeats] = useState<number>(1);
  const [niches, setNiches] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const planDefaults: Record<string, { records: number; seats: number }> = {
    starter: { records: 1000, seats: 1 },
    growth: { records: 5000, seats: 3 },
    agency: { records: 25000, seats: 10 },
  };

  const fetchRollup = useServerFn(getAgencyRollup);
  const create = useServerFn(createSubAccount);
  const doSwitch = useServerFn(switchTeam);

  const isAgencyAdmin = (role === "admin" && team?.parent_team_id === null) || isSuperAdmin;

  const load = async () => {
    try { const r = await fetchRollup({ data: undefined as any }); setData(r); }
    catch (e: any) { toast.error(e.message ?? "Failed to load"); }
  };

  useEffect(() => { if (isAgencyAdmin) load(); }, [isAgencyAdmin, team?.id]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r: any = await create({
        data: {
          name: name.trim(),
          plan,
          adminEmail: adminEmail.trim() || null,
          primary: primary || null,
          secondary: secondary || null,
          whiteLabelName: whiteLabelName.trim() || null,
          discoveryMonthlyLimit: Number.isFinite(monthlyRecords) ? Math.max(0, Math.floor(monthlyRecords)) : null,
          seatLimit: Number.isFinite(seats) ? Math.max(1, Math.floor(seats)) : null,
          niche: niches.length ? niches.join(",") : null,
        },
      });
      if (r?.invite?.email_sent) toast.success(`Sub-account created — invite sent to ${r.invite.email}`);
      else if (r?.invite && !r.invite.email_sent) toast.success(`Sub-account created — ${r.invite.email} will get admin access on next sign-in`);
      else toast.success("Sub-account created");
      setName(""); setPlan("starter"); setAdminEmail(""); setPrimary("#2563EB"); setSecondary("#8B5CF6"); setWhiteLabelName(""); setMonthlyRecords(1000); setSeats(1); setNiche("");
      setOpen(false);
      load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };


  const openTeam = async (id: string) => {
    try {
      await doSwitch({ data: { teamId: id } });
      await refresh();
      toast.success("Switched team");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isAgencyAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-6">
          <h2 className="font-semibold mb-2">Agency dashboard</h2>
          <p className="text-sm text-muted-foreground">Only agency admins can view sub-accounts.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Agency" subtitle="Manage sub-accounts and see usage across your agency." />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> New sub-account</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create sub-account</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="sub-name">Sub-account name</Label>
                  <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Realty" />
                </div>
                <div>
                  <Label>Plan</Label>
                  <Select value={plan} onValueChange={(v) => {
                    setPlan(v as any);
                    const d = planDefaults[v] ?? planDefaults.starter;
                    setMonthlyRecords(d.records);
                    setSeats(d.seats);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (1k records · 1 seat)</SelectItem>
                      <SelectItem value="growth">Growth (5k records · 3 seats)</SelectItem>
                      <SelectItem value="agency">Agency (25k records · 10 seats)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sub-seats">Seats</Label>
                  <Input id="sub-seats" type="number" min={1} value={seats}
                    onChange={(e) => setSeats(parseInt(e.target.value || "1", 10))} />
                </div>
                <div>
                  <Label htmlFor="sub-records">Monthly discovery records</Label>
                  <Input id="sub-records" type="number" min={0} value={monthlyRecords}
                    onChange={(e) => setMonthlyRecords(parseInt(e.target.value || "0", 10))} />
                </div>
                <div>
                  <Label>Niche (locks discovery)</Label>
                  <Select value={niche} onValueChange={setNiche}>
                    <SelectTrigger><SelectValue placeholder="Pick niche…" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {DISCOVERY_INDUSTRIES.map((i) => (
                        <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">Discovery searches auto-scope to this niche.</p>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="sub-admin">Assigned admin email</Label>
                  <Input id="sub-admin" type="email" value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@client.com" />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    We'll invite them and grant admin access on first sign-in.
                  </p>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="sub-wl">Brand name (optional)</Label>
                  <Input id="sub-wl" value={whiteLabelName}
                    onChange={(e) => setWhiteLabelName(e.target.value)} placeholder="Shown to their users in place of yours" />
                </div>
                <div>
                  <Label htmlFor="sub-primary">Primary color</Label>
                  <div className="flex gap-2 items-center">
                    <Input id="sub-primary" type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-14 h-9 p-1" />
                    <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="sub-secondary">Secondary color</Label>
                  <div className="flex gap-2 items-center">
                    <Input id="sub-secondary" type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="w-14 h-9 p-1" />
                    <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} className="font-mono text-xs" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={busy || !name.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Building2} label="Sub-accounts" value={data?.totalChildren ?? 0} />
        <Stat icon={Users} label="Seats used" value={`${data?.totalSeats ?? 0} / ${data?.totalSeatLimit ?? 0}`} />
        <Stat icon={Database} label="Contacts" value={`${(data?.totalContacts ?? 0).toLocaleString()} / ${(data?.totalContactLimit ?? 0).toLocaleString()}`} />
        <Stat icon={Megaphone} label="Active campaigns" value={data?.activeCampaigns ?? 0} />
      </div>

      <Card className="bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Sub-accounts</h3>
          <p className="text-xs text-muted-foreground">Switch into any sub-account to manage it.</p>
        </div>
        {data && data.children.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground italic">No sub-accounts yet. Create one to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Plan</th>
                <th className="text-left px-4 py-2">Seats</th>
                <th className="text-left px-4 py-2">Contacts</th>
                <th className="text-left px-4 py-2">Campaigns</th>
                <th className="text-right px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.children.map((c, i) => (
                <tr key={c.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2"><Badge variant="secondary" className="capitalize">{c.plan}</Badge></td>
                  <td className="px-4 py-2 text-xs">{c.seats_used} / {c.seat_limit}</td>
                  <td className="px-4 py-2 text-xs">{c.contacts_used.toLocaleString()} / {c.contact_limit.toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs">{c.active_campaigns}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <BrandingDialog teamId={c.id} teamName={c.name} onSaved={load} />
                      <AssignAdminDialog teamId={c.id} teamName={c.name} />
                      <Button size="sm" variant="ghost" onClick={() => openTeam(c.id)}>
                        <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Open
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </Card>
  );
}

function BrandingDialog({ teamId, teamName, onSaved }: { teamId: string; teamName: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [busy, setBusy] = useState(false);
  const save = _useServerFn(updateSubAccountBranding);

  const onSave = async () => {
    setBusy(true);
    try {
      await save({ data: { teamId, primary: primary || null, secondary: secondary || null, white_label_name: name || null, white_label_logo: logo || null } });
      toast.success("Branding updated");
      setOpen(false);
      onSaved();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Branding"><Palette className="w-3.5 h-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Branding — {teamName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>White-label name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={teamName} />
          </div>
          <div>
            <Label>Logo URL</Label>
            <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Primary color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={primary || "#3b82f6"} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" />
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#3b82f6" />
              </div>
            </div>
            <div>
              <Label>Secondary color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={secondary || "#64748b"} onChange={(e) => setSecondary(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" />
                <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="#64748b" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={busy}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignAdminDialog({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Array<{ id: string; email: string; name: string; role: string | null }>>([]);
  const [pick, setPick] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const list = _useServerFn(listSubAccountMembers);
  const assign = _useServerFn(assignSubAccountAdmin);

  useEffect(() => {
    if (!open) return;
    list({ data: { teamId } }).then((r: any) => setMembers(r.members ?? [])).catch(() => {});
  }, [open]);

  const onAssign = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await assign({ data: { teamId, userId: pick } });
      toast.success("Admin assigned");
      setOpen(false);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Assign admin"><UserCog className="w-3.5 h-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign admin — {teamName}</DialogTitle></DialogHeader>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No members in this sub-account yet. Switch into the sub-account and invite users from the Team page first.
          </p>
        ) : (
          <div className="space-y-2">
            <Label>Pick a member</Label>
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger><SelectValue placeholder="Choose user" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || m.email} {m.role === "admin" ? "(already admin)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onAssign} disabled={busy || !pick || members.length === 0}>Assign as admin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
