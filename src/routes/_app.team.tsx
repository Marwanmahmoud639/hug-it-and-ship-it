import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listTeamMembers,
  inviteTeamMember,
  cancelTeamInvite,
  resendTeamInvite,
  updateMemberRole,
  removeTeamMember,
} from "@/lib/team.functions";
import { toast } from "sonner";
import { Loader2, UserPlus, X, Mail, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/team")({ component: Team });

type Role = "admin" | "manager" | "agent";
const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  agent: "Agent",
};
const ROLE_DESC: Record<Role, string> = {
  admin: "Full access — manage team, billing, settings.",
  manager: "Create/edit campaigns and contacts.",
  agent: "View and work assigned contacts.",
};

function Team() {
  const { team, profile, role } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listTeamMembers);
  const invite = useServerFn(inviteTeamMember);
  const cancel = useServerFn(cancelTeamInvite);
  const resend = useServerFn(resendTeamInvite);
  const updateRole = useServerFn(updateMemberRole);
  const remove = useServerFn(removeTeamMember);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("agent");

  const isAdmin = role === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["team-members", team?.id],
    queryFn: () => list(),
    enabled: !!team?.id && team?.plan !== "starter",
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["team-members", team?.id] });

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { email, role: inviteRole } }),
    onSuccess: (r) => {
      toast.success(r.message ?? "Invitation sent", {
        description: r.already_registered
          ? "That email already has an account — they can sign in to join."
          : undefined,
      });
      setEmail("");
      setInviteRole("agent");
      setOpen(false);
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to invite"),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: Role }) => updateRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update role"),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => remove({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Member removed");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove"),
  });

  const cancelMut = useMutation({
    mutationFn: (invite_id: string) => cancel({ data: { invite_id } }),
    onSuccess: () => {
      toast.success("Invite cancelled");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to cancel"),
  });

  const resendMut = useMutation({
    mutationFn: (invite_id: string) => resend({ data: { invite_id } }),
    onSuccess: (r) => toast.success(r.message ?? "Invitation resent"),
    onError: (e: any) => toast.error(e?.message ?? "Failed to resend"),
  });

  if (team?.plan === "starter") {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <PageHeader title="Team" />
        <EmptyState
          title="Team management is a Growth feature"
          body="Upgrade to Growth or Agency to invite teammates and assign roles."
        />
      </div>
    );
  }

  const members = data?.members ?? [];
  const invites = data?.invites ?? [];
  const seatLimit = data?.seat_limit ?? team?.seat_limit ?? 1;
  const seatsUsed = members.length + invites.length;
  const seatsLeft = Math.max(0, seatLimit - seatsUsed);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Team"
          subtitle={`${seatsUsed} of ${seatLimit} seats used${invites.length ? ` · ${invites.length} pending` : ""}`}
        />
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={seatsLeft === 0}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a teammate</DialogTitle>
                <DialogDescription>
                  We'll email them a link to join your team. {seatsLeft} seat
                  {seatsLeft === 1 ? "" : "s"} remaining.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="teammate@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["admin", "manager", "agent"] as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          <div className="flex flex-col">
                            <span>{ROLE_LABEL[r]}</span>
                            <span className="text-xs text-muted-foreground">{ROLE_DESC[r]}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => inviteMut.mutate()}
                  disabled={!email || inviteMut.isPending}
                >
                  {inviteMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3 w-40">Role</th>
              <th className="text-right px-4 py-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
                </td>
              </tr>
            )}
            {members.map((m: any) => {
              const isSelf = m.id === profile?.id;
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">
                    {m.name || "—"}
                    {isSelf && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        you
                      </Badge>
                    )}
                    {m.is_owner && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        owner
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-2">
                    {isAdmin && !m.is_owner ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          roleMut.mutate({ user_id: m.id, role: v as Role })
                        }
                        disabled={roleMut.isPending}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["admin", "manager", "agent"] as Role[]).map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge>{ROLE_LABEL[m.role as Role] ?? m.role}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isAdmin && !isSelf && !m.is_owner && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {m.name || m.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              They'll lose access to this team immediately. Their account
                              will not be deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeMut.mutate(m.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              );
            })}

            {invites.map((inv: any) => (
              <tr key={inv.id} className="border-t border-border bg-muted/20">
                <td className="px-4 py-2 font-medium text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 inline mr-2" />
                  Pending invite
                </td>
                <td className="px-4 py-2 text-muted-foreground">{inv.email}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline">{ROLE_LABEL[inv.role as Role] ?? inv.role}</Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  {isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resendMut.mutate(inv.id)}
                        disabled={resendMut.isPending}
                      >
                        Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => cancelMut.mutate(inv.id)}
                        disabled={cancelMut.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {!isLoading && members.length === 0 && invites.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No teammates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground mt-4">
          Only admins can invite, change roles, or remove members.
        </p>
      )}
    </div>
  );
}
