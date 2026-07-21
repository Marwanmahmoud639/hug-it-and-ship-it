import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminOverview,
  listSignups,
  listPayments,
  listSubscriptions,
  provisionAccess,
  createManualUser,
  cancelSubscription,
  isStaffCheck,
} from "@/lib/admin.functions";
import { adminApproveSignup, adminRegenerateCode } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DollarSign, Users, Activity, CheckCircle2, UserPlus, Shield, RefreshCw, XCircle,
  Copy, KeyRound, Check,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — R4D" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const checkStaff = useServerFn(isStaffCheck);
  const { data: staff, isLoading } = useQuery({ queryKey: ["is-staff"], queryFn: () => checkStaff() });

  if (isLoading) {
    return <div className="min-h-screen r4d-obsidian flex items-center justify-center text-white/60">Verifying access…</div>;
  }
  if (!staff?.isStaff) {
    return (
      <div className="min-h-screen r4d-obsidian flex items-center justify-center">
        <div className="r4d-glass rounded-2xl p-10 max-w-md text-center">
          <Shield className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Staff access only</h1>
          <p className="text-white/60">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen r4d-obsidian text-white" style={{ fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif' }}>
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Control Room</h1>
            <p className="text-white/50 mt-1">Provision access, monitor revenue, and manage customers.</p>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Staff</Badge>
        </div>

        <OverviewCards />

        <Tabs defaultValue="queue" className="mt-10">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="queue">Provisioning Queue</TabsTrigger>
            <TabsTrigger value="signups">Signups</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="manual">Manual Create</TabsTrigger>
          </TabsList>
          <TabsContent value="queue"><QueueTab /></TabsContent>
          <TabsContent value="signups"><SignupsTab /></TabsContent>
          <TabsContent value="customers"><CustomersTab /></TabsContent>
          <TabsContent value="payments"><PaymentsTab /></TabsContent>
          <TabsContent value="manual"><ManualCreateTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OverviewCards() {
  const fn = useServerFn(adminOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn() });
  const cards = [
    { label: "MRR", value: data ? `$${data.mrr.toLocaleString()}` : "—", icon: DollarSign, color: "from-emerald-400 to-teal-500" },
    { label: "Paid this month", value: data ? `$${Number(data.paidThisMonth).toLocaleString()}` : "—", icon: Activity, color: "from-teal-400 to-cyan-500" },
    { label: "Active subs", value: data ? String(data.activeSubsCount) : "—", icon: CheckCircle2, color: "from-emerald-500 to-green-600" },
    { label: "Signups (7d)", value: data ? String(data.signups7d) : "—", icon: Users, color: "from-cyan-400 to-blue-500" },
    { label: "Pending provision", value: data ? String(data.pending) : "—", icon: RefreshCw, color: "from-amber-400 to-orange-500" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="r4d-glass rounded-xl p-5">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center mb-3`}>
            <c.icon className="w-4 h-4 text-black" />
          </div>
          <div className="text-2xl font-bold">{c.value}</div>
          <div className="text-xs text-white/50 mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function QueueTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listSignups);
  const approve = useServerFn(adminApproveSignup);
  const regen = useServerFn(adminRegenerateCode);

  // Pull pending-approval AND already-approved (so admin can see/copy the code)
  const pending = useQuery({
    queryKey: ["signups", "paid_pending_approval"],
    queryFn: () => fn({ data: { status: "paid_pending_approval" } }),
  });
  const awaiting = useQuery({
    queryKey: ["signups", "approved_awaiting_activation"],
    queryFn: () => fn({ data: { status: "approved_awaiting_activation" } }),
  });

  const approveMut = useMutation({
    mutationFn: (signupId: string) => approve({ data: { signupId } }),
    onSuccess: (res) => {
      toast.success(`Approved — code ${res.code} ${res.emailQueued ? "(emailed)" : "(email pending)"}`);
      qc.invalidateQueries({ queryKey: ["signups"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to approve"),
  });
  const regenMut = useMutation({
    mutationFn: (signupId: string) => regen({ data: { signupId } }),
    onSuccess: (res) => {
      toast.success(`New code: ${res.code}`);
      qc.invalidateQueries({ queryKey: ["signups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to regenerate"),
  });

  const pendingRows = pending.data?.signups ?? [];
  const awaitingRows = awaiting.data?.signups ?? [];

  return (
    <div className="space-y-6 mt-6">
      <div className="r4d-glass rounded-xl p-6">
        <h3 className="font-bold mb-1">Paid — awaiting approval ({pendingRows.length})</h3>
        <p className="text-xs text-white/50 mb-4">Customers who completed Whop checkout and entered their email on /signup. Approve to mint a one-time 6-digit access code.</p>
        {pendingRows.length === 0 ? (
          <p className="text-white/50 text-sm">Nothing pending.</p>
        ) : (
          <Table headers={["Email", "Name", "Plan", "Paid", ""]}>
            {pendingRows.map((r: any) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="py-3 px-2">{r.email}</td>
                <td className="py-3 px-2">{r.full_name ?? "—"}</td>
                <td className="py-3 px-2"><Badge variant="secondary">{r.selected_plan_slug ?? "—"}</Badge></td>
                <td className="py-3 px-2 text-white/60">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="py-3 px-2 text-right">
                  <Button size="sm" disabled={approveMut.isPending} onClick={() => approveMut.mutate(r.id)} className="r4d-bg-lime hover:opacity-90 text-black">
                    <Check className="w-4 h-4 mr-1" /> Approve & mint code
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <div className="r4d-glass rounded-xl p-6">
        <h3 className="font-bold mb-1">Approved — awaiting activation ({awaitingRows.length})</h3>
        <p className="text-xs text-white/50 mb-4">Access code minted. Customer hasn't entered it yet. Copy if you need to resend manually, or regenerate if lost.</p>
        {awaitingRows.length === 0 ? (
          <p className="text-white/50 text-sm">No outstanding codes.</p>
        ) : (
          <Table headers={["Email", "Plan", "Access code", "Expires", ""]}>
            {awaitingRows.map((r: any) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="py-3 px-2">{r.email}</td>
                <td className="py-3 px-2"><Badge variant="secondary">{r.selected_plan_slug ?? "—"}</Badge></td>
                <td className="py-3 px-2">
                  <CodeCell code={r.access_code} />
                </td>
                <td className="py-3 px-2 text-white/60 text-xs">
                  {r.access_code_expires_at ? new Date(r.access_code_expires_at).toLocaleString() : "—"}
                </td>
                <td className="py-3 px-2 text-right">
                  <Button size="sm" variant="ghost" disabled={regenMut.isPending} onClick={() => regenMut.mutate(r.id)} className="text-white/70 hover:text-white">
                    <KeyRound className="w-4 h-4 mr-1" /> Regenerate
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}

function CodeCell({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-white/40">—</span>;
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        toast.success("Code copied");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-2 font-mono text-lg tracking-widest r4d-lime hover:text-white transition"
    >
      {code}
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 opacity-60" />}
    </button>
  );
}

function SignupsTab() {
  const fn = useServerFn(listSignups);
  const { data } = useQuery({ queryKey: ["signups", "all"], queryFn: () => fn({ data: {} }) });
  const rows = data?.signups ?? [];
  return (
    <div className="r4d-glass rounded-xl p-6 mt-6">
      <h3 className="font-bold mb-4">All signups ({rows.length})</h3>
      <Table headers={["Email", "Name", "Status", "Plan", "Created"]}>
        {rows.map((r: any) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="py-3 px-2">{r.email}</td>
            <td className="py-3 px-2">{r.full_name ?? "—"}</td>
            <td className="py-3 px-2"><StatusBadge status={r.status} /></td>
            <td className="py-3 px-2">{r.selected_plan_slug ?? "—"}</td>
            <td className="py-3 px-2 text-white/60">{new Date(r.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function CustomersTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listSubscriptions);
  const cancel = useServerFn(cancelSubscription);
  const { data } = useQuery({ queryKey: ["subscriptions"], queryFn: () => fn() });
  const mut = useMutation({
    mutationFn: (id: string) => cancel({ data: { subscriptionId: id } }),
    onSuccess: () => { toast.success("Canceled"); qc.invalidateQueries({ queryKey: ["subscriptions"] }); },
  });
  const rows = data?.subscriptions ?? [];
  return (
    <div className="r4d-glass rounded-xl p-6 mt-6">
      <h3 className="font-bold mb-4">Customers ({rows.length})</h3>
      <Table headers={["Plan", "Seats", "Status", "Renews", ""]}>
        {rows.map((r: any) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="py-3 px-2"><Badge variant="secondary">{r.plan_slug}</Badge></td>
            <td className="py-3 px-2">{r.seats}</td>
            <td className="py-3 px-2"><StatusBadge status={r.status} /></td>
            <td className="py-3 px-2 text-white/60">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}</td>
            <td className="py-3 px-2 text-right">
              {r.status === "active" && (
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => mut.mutate(r.id)}>
                  <XCircle className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function PaymentsTab() {
  const fn = useServerFn(listPayments);
  const { data } = useQuery({ queryKey: ["payments"], queryFn: () => fn() });
  const rows = data?.payments ?? [];
  return (
    <div className="r4d-glass rounded-xl p-6 mt-6">
      <h3 className="font-bold mb-4">Payments ({rows.length})</h3>
      <Table headers={["Email", "Amount", "Status", "Plan", "Date"]}>
        {rows.map((r: any) => (
          <tr key={r.id} className="border-t border-white/5">
            <td className="py-3 px-2">{r.buyer_email ?? "—"}</td>
            <td className="py-3 px-2 font-mono">${Number(r.amount).toFixed(2)} {r.currency?.toUpperCase()}</td>
            <td className="py-3 px-2"><StatusBadge status={r.status} /></td>
            <td className="py-3 px-2 text-white/60 truncate max-w-[200px]">{r.whop_plan_id ?? "—"}</td>
            <td className="py-3 px-2 text-white/60">{new Date(r.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function ManualCreateTab() {
  const qc = useQueryClient();
  const fn = useServerFn(createManualUser);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", planSlug: "starter", seats: 1 });
  const mut = useMutation({
    mutationFn: () => fn({ data: form }),
    onSuccess: () => {
      toast.success("Invite sent");
      setOpen(false);
      setForm({ email: "", fullName: "", planSlug: "starter", seats: 1 });
      qc.invalidateQueries({ queryKey: ["signups"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <div className="r4d-glass rounded-xl p-6 mt-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="font-bold">Manually provision a user</h3>
          <p className="text-white/50 text-sm mt-1">Skips Whop payment. Sends a Supabase invite email and activates the plan.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-500 hover:bg-emerald-400 text-black">
              <UserPlus className="w-4 h-4 mr-2" /> New user
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-white/10">
            <DialogHeader><DialogTitle>Create user & provision</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Full name</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plan</Label>
                  <select className="w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm"
                    value={form.planSlug} onChange={(e) => setForm({ ...form, planSlug: e.target.value })}>
                    <option value="starter">Starter Engine ($149)</option>
                    <option value="professional">Professional Engine ($499)</option>
                    <option value="enterprise">Enterprise Engine ($999)</option>
                  </select>
                </div>
                <div>
                  <Label>Seats</Label>
                  <Input type="number" min={1} max={50} value={form.seats}
                    onChange={(e) => setForm({ ...form, seats: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.email || !form.fullName}
                className="bg-emerald-500 hover:bg-emerald-400 text-black">
                {mut.isPending ? "Creating…" : "Create & invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-white/50 text-xs uppercase tracking-wider">
            {headers.map((h) => <th key={h} className="py-2 px-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    paid: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    provisioned: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    succeeded: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    canceled: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    failed: "bg-red-500/15 text-red-300 border-red-500/30",
    refunded: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return <Badge className={`${map[status] ?? "bg-white/10 text-white/70"} border`}>{status}</Badge>;
}
