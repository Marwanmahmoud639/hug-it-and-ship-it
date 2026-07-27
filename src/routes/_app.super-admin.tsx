import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { Shield, Check, X, Clock, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { switchTeam } from "@/lib/teams.functions";
import { listAllSubdomainRequests, decideSubdomainRequest } from "@/lib/subdomains.functions";
import { listManagedUsers, inviteUserWithMarket, listAllUsersForAdmin, listAllTeamsForAdmin, reassignUserToTeam, removeUserCompletely, inviteUserToTeam, setTeamLimits } from "@/lib/admin-users.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Users } from "lucide-react";
import { AccountProvisioningCard, BillingRateCard } from "@/components/settings/account-provisioning-card";

export const Route = createFileRoute("/_app/super-admin")({ component: SuperAdminPage });

type Stats = { teams: number; users: number; contacts: number; campaigns: number; searches: number };
type SAdmin = { user_id: string; granted_at: string; email?: string; name?: string };
type TeamRow = { id: string; name: string; plan: string; contact_limit: number; created_at: string };
type LoginReq = { id: string; email: string; status: string; ip_address: string | null; user_agent: string | null; requested_at: string };

function SuperAdminPage() {
  const { isSuperAdmin, loading, refresh } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [admins, setAdmins] = useState<SAdmin[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loginReqs, setLoginReqs] = useState<LoginReq[]>([]);
  const doSwitch = useServerFn(switchTeam);

  const impersonate = async (teamId: string) => {
    try {
      await doSwitch({ data: { teamId } });
      await refresh();
      toast.success("Switched into team");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const load = async () => {
    const [t, u, c, ca, s, sa, tm, lr] = await Promise.all([
      supabase.from("teams").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }),
      supabase.from("searches").select("id", { count: "exact", head: true }),
      supabase.from("super_admins").select("user_id, granted_at").order("granted_at", { ascending: false }),
      supabase.from("teams").select("id, name, plan, contact_limit, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("login_requests").select("id, email, status, ip_address, user_agent, requested_at").order("requested_at", { ascending: false }).limit(100),
    ]);
    setStats({
      teams: t.count ?? 0, users: u.count ?? 0, contacts: c.count ?? 0,
      campaigns: ca.count ?? 0, searches: s.count ?? 0,
    });
    setTeams((tm.data ?? []) as TeamRow[]);
    setLoginReqs((lr.data ?? []) as LoginReq[]);
    const list = (sa.data ?? []) as SAdmin[];
    if (list.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, email, name").in("id", list.map(x => x.user_id));
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setAdmins(list.map(x => ({ ...x, email: map.get(x.user_id)?.email, name: map.get(x.user_id)?.name })));
    } else { setAdmins([]); }
  };

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  // Realtime: refresh login_requests on any change
  useEffect(() => {
    if (!isSuperAdmin) return;
    const channel = supabase
      .channel("super-admin-login-reqs")
      .on("postgres_changes", { event: "*", schema: "public", table: "login_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isSuperAdmin]);

  const decideRequest = async (id: string, action: "approve" | "deny") => {
    const fn = action === "approve" ? "approve_login_request" : "deny_login_request";
    const { error } = await supabase.rpc(fn as any, { _request_id: id });
    if (error) return toast.error(error.message);
    toast.success(action === "approve" ? "Approved — user can now sign in" : "Denied — email blocked for 24h");
    load();
  };


  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-8 text-center bg-card">
          <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold">Super admin only</h2>
          <p className="text-sm text-muted-foreground mt-1">This area is restricted to platform super administrators.</p>
        </Card>
      </div>
    );
  }


  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-1"><Shield className="w-5 h-5 text-primary" /><PageHeader title="Super Admin" subtitle="Platform-wide access. Use with care." /></div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats && [
          { l: "Teams", v: stats.teams },
          { l: "Users", v: stats.users },
          { l: "Contacts", v: stats.contacts },
          { l: "Campaigns", v: stats.campaigns },
          { l: "Searches", v: stats.searches },
        ].map(k => (
          <Card key={k.l} className="p-4 bg-card">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-bold">{k.v.toLocaleString()}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-card">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Creator-locked access</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Super admin is permanently locked to the platform creator{admins[0]?.email ? ` (${admins[0].email})` : ""}.
              Granting or revoking is disabled.
            </p>
          </div>
        </div>
      </Card>

      <Card className="bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">All teams</h3>
          <p className="text-xs text-muted-foreground">Latest 50 teams on the platform.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Plan</th><th className="text-left px-4 py-2">Contact limit</th><th className="text-left px-4 py-2">Created</th><th className="text-right px-4 py-2">Action</th></tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2"><Badge variant="secondary" className="capitalize">{t.plan}</Badge></td>
                <td className="px-4 py-2">{t.contact_limit.toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => impersonate(t.id)} aria-label="Impersonate">
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Impersonate
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Login Approvals</h3>
            <p className="text-xs text-muted-foreground">First-time sign-ins need your approval. Approved emails are remembered.</p>
          </div>
          <Badge variant="secondary">{loginReqs.filter(r => r.status === "pending").length} pending</Badge>
        </div>
        {loginReqs.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground italic">No login requests yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Requested</th>
                <th className="text-left px-4 py-2">IP</th>
                <th className="text-left px-4 py-2">User Agent</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {loginReqs.map((r, i) => (
                <tr key={r.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
                  <td className="px-4 py-2 font-medium">{r.email}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs font-mono">{r.ip_address || "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[240px]" title={r.user_agent || ""}>{r.user_agent || "—"}</td>
                  <td className="px-4 py-2">
                    <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "destructive"} className="capitalize">{r.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.status === "pending" ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => decideRequest(r.id, "approve")} aria-label="Approve">
                          <Check className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => decideRequest(r.id, "deny")} aria-label="Deny">
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <UserManagementCard />
      <AccountProvisioningCard />
      <BillingRateCard />
      <AssignUsersCard />
      <TeamLimitsCard />
      <SubdomainApprovalsCard />
    </div>
  );
}

function UserManagementCard() {
  const list = useServerFn(listManagedUsers);
  const invite = useServerFn(inviteUserWithMarket);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "agent">("agent");
  const [market, setMarket] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => list({ data: undefined as any }).then((r: any) => setUsers(r.users ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await invite({ data: { email, role, market: market || undefined } });
      toast.success("Invitation sent");
      setOpen(false); setEmail(""); setMarket("");
      load();
    } catch (err: any) { toast.error(err?.message ?? "Failed to invite"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" />User Management Console</h3>
          <p className="text-xs text-muted-foreground">Active workspace users, subscription health from Whop, and last activity.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="w-4 h-4 mr-1.5" />Create User / Grant Access</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite new user</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="invite-email">User email</Label>
                <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" />
              </div>
              <div>
                <Label htmlFor="invite-role">Assigned role</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invite-market">Target market allocation</Label>
                <Input id="invite-market" value={market} onChange={(e) => setMarket(e.target.value)} placeholder="Atlanta, GA · 30303" />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {users.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground italic">No users yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Team</th>
              <th className="text-left px-4 py-2">Plan</th>
              <th className="text-left px-4 py-2">Whop status</th>
              <th className="text-left px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-2">
                  <div className="font-medium">{u.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-2">{u.team ?? "—"}</td>
                <td className="px-4 py-2"><Badge variant="secondary" className="capitalize">{u.plan ?? "—"}</Badge></td>
                <td className="px-4 py-2">
                  {u.whop ? (
                    <Badge variant={u.whop.status === "active" ? "default" : u.whop.status === "cancelled" || u.whop.status === "failed" ? "destructive" : "secondary"} className="capitalize">{u.whop.status}</Badge>
                  ) : <span className="text-xs text-muted-foreground">no Whop record</span>}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function SubdomainApprovalsCard() {
  const list = useServerFn(listAllSubdomainRequests);
  const decide = useServerFn(decideSubdomainRequest);
  const [rows, setRows] = useState<any[]>([]);
  const load = () => list({ data: undefined as any }).then((r: any) => setRows(r.requests ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const act = async (id: string, approve: boolean) => {
    let reason: string | undefined;
    if (!approve) {
      const r = prompt("Reason for denial (optional)") ?? "";
      reason = r || undefined;
    }
    try {
      await decide({ data: { id, approve, reason } });
      toast.success(approve ? "Approved" : "Denied");
      load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <Card className="bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Subdomain requests</h3>
          <p className="text-xs text-muted-foreground">Sub-accounts request branded subdomains under dialingfordollars.co.</p>
        </div>
        <Badge variant="secondary">{pending.length} pending</Badge>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground italic">No subdomain requests yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Team</th>
              <th className="text-left px-4 py-2">Subdomain</th>
              <th className="text-left px-4 py-2">Requested</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-2 font-medium">{r.teams?.name ?? r.team_id}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.subdomain}.dialingfordollars.co</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <Badge variant={r.status === "approved" ? "default" : r.status === "denied" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  {r.status === "pending" ? (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => act(r.id, true)} aria-label="Approve"><Check className="w-4 h-4 text-primary" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => act(r.id, false)} aria-label="Deny"><X className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function AssignUsersCard() {
  const listUsers = useServerFn(listAllUsersForAdmin);
  const listTeams = useServerFn(listAllTeamsForAdmin);
  const reassign = useServerFn(reassignUserToTeam);
  const remove = useServerFn(removeUserCompletely);
  const invite = useServerFn(inviteUserToTeam);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<{ user: any; teamId: string; role: "admin" | "manager" | "agent" } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invTeam, setInvTeam] = useState("");
  const [invRole, setInvRole] = useState<"admin" | "manager" | "agent">("admin");
  const [busy, setBusy] = useState(false);

  const load = () => {
    listUsers({ data: undefined as any }).then((r: any) => setUsers(r.users ?? [])).catch(() => {});
    listTeams({ data: undefined as any }).then((r: any) => setTeams(r.teams ?? [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return !q || (u.email ?? "").toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q) || (u.team_name ?? "").toLowerCase().includes(q);
  });

  const saveReassign = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await reassign({ data: { userId: edit.user.id, teamId: edit.teamId, role: edit.role } });
      toast.success("User reassigned");
      setEdit(null);
      load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const doRemove = async (id: string, email: string) => {
    if (!confirm(`Permanently delete ${email}? This removes their account and all access.`)) return;
    try { await remove({ data: { userId: id } }); toast.success("User removed"); load(); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const doInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invTeam) return toast.error("Pick a team");
    setBusy(true);
    try {
      await invite({ data: { email: invEmail, teamId: invTeam, role: invRole } });
      toast.success("Invitation sent");
      setInviteOpen(false); setInvEmail(""); setInvTeam(""); setInvRole("admin");
      load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Assign users to agencies</h3>
          <p className="text-xs text-muted-foreground">Move, remove, or invite users into any team. Bypasses seat limits.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 w-48" />
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="w-4 h-4 mr-1.5" />Invite to team</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Invite user into a specific team</DialogTitle></DialogHeader>
              <form onSubmit={doInvite} className="space-y-4">
                <div><Label>Email</Label><Input type="email" required value={invEmail} onChange={(e) => setInvEmail(e.target.value)} /></div>
                <div>
                  <Label>Team / agency</Label>
                  <Select value={invTeam} onValueChange={setInvTeam}>
                    <SelectTrigger><SelectValue placeholder="Pick team" /></SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.parent_team_id ? " (sub)" : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={invRole} onValueChange={(v: any) => setInvRole(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Invite"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="max-h-[500px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
            <tr>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Current team</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-2">
                  <div className="font-medium">{u.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-2">
                  <div>{u.team_name ?? "—"}</div>
                  {u.is_sub_account && <Badge variant="secondary" className="text-[10px] mt-0.5">sub-account</Badge>}
                </td>
                <td className="px-4 py-2"><Badge variant="outline" className="capitalize">{u.role ?? "—"}</Badge></td>
                <td className="px-4 py-2 text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ user: u, teamId: u.team_id, role: (u.role as any) ?? "agent" })}>
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />Move
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => doRemove(u.id, u.email)} className="text-destructive hover:text-destructive">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Move {edit?.user.email}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div>
                <Label>Target team</Label>
                <Select value={edit.teamId ?? ""} onValueChange={(v) => setEdit({ ...edit, teamId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick team" /></SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.parent_team_id ? " (sub)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role in target team</Label>
                <Select value={edit.role} onValueChange={(v: any) => setEdit({ ...edit, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (full sub-account access)</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={saveReassign} disabled={busy || !edit?.teamId}>{busy ? "Saving…" : "Move user"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TeamLimitsCard() {
  const listTeams = useServerFn(listAllTeamsForAdmin);
  const setLimits = useServerFn(setTeamLimits);
  const [teams, setTeams] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { seat_limit: number; contact_limit: number }>>({});

  const load = () => listTeams({ data: undefined as any }).then((r: any) => {
    setTeams(r.teams ?? []);
    const d: any = {};
    for (const t of r.teams ?? []) d[t.id] = { seat_limit: t.seat_limit, contact_limit: t.contact_limit };
    setDrafts(d);
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (teamId: string) => {
    try {
      await setLimits({ data: { teamId, seat_limit: drafts[teamId].seat_limit, contact_limit: drafts[teamId].contact_limit } });
      toast.success("Limits updated");
      load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <Card className="bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">Team limits (seats & contacts)</h3>
        <p className="text-xs text-muted-foreground">Raise or lower caps for any team. Super admin bypasses all caps when assigning.</p>
      </div>
      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground sticky top-0">
            <tr>
              <th className="text-left px-4 py-2">Team</th>
              <th className="text-left px-4 py-2">Plan</th>
              <th className="text-left px-4 py-2">Seat limit</th>
              <th className="text-left px-4 py-2">Contact limit</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.id} className={`border-t border-border ${i % 2 ? "bg-muted/20" : ""}`}>
                <td className="px-4 py-2 font-medium">{t.name}{t.parent_team_id ? <Badge variant="secondary" className="ml-2 text-[10px]">sub</Badge> : null}</td>
                <td className="px-4 py-2"><Badge variant="secondary" className="capitalize">{t.plan}</Badge></td>
                <td className="px-4 py-2">
                  <Input type="number" min={1} className="h-8 w-24" value={drafts[t.id]?.seat_limit ?? ""} onChange={(e) => setDrafts({ ...drafts, [t.id]: { ...drafts[t.id], seat_limit: Number(e.target.value) } })} />
                </td>
                <td className="px-4 py-2">
                  <Input type="number" min={1} className="h-8 w-32" value={drafts[t.id]?.contact_limit ?? ""} onChange={(e) => setDrafts({ ...drafts, [t.id]: { ...drafts[t.id], contact_limit: Number(e.target.value) } })} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => save(t.id)}>Save</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
