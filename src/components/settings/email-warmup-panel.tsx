import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Flame, ShieldAlert, Play, Square, CheckCircle2, AlertTriangle, Plus, X } from "lucide-react";
import { listWarmupStatus, startWarmup, stopWarmup, flagWarmup, acknowledgeWarmupFlag } from "@/lib/email-warmup.functions";
import { addEmailAccount } from "@/lib/email-accounts.functions";

const RAMP = [5, 10, 20, 40, 60, 80, 100];

function daysLeft(day: number) {
  return Math.max(0, 7 - day);
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    idle:    { label: "Idle",    cls: "bg-muted text-muted-foreground",   Icon: Flame },
    warming: { label: "Warming", cls: "bg-amber-500/15 text-amber-500",   Icon: Flame },
    ready:   { label: "Ready",   cls: "bg-emerald-500/15 text-emerald-500", Icon: CheckCircle2 },
    spammed: { label: "Spammed", cls: "bg-orange-500/15 text-orange-500", Icon: AlertTriangle },
    burned:  { label: "Burned",  cls: "bg-red-500/15 text-red-500",       Icon: ShieldAlert },
  };
  const v = map[s] ?? map.idle;
  const I = v.Icon;
  return <Badge variant="outline" className={`gap-1 ${v.cls} border-0`}><I className="w-3 h-3" />{v.label}</Badge>;
}

export function EmailWarmupPanel() {
  const list = useServerFn(listWarmupStatus);
  const start = useServerFn(startWarmup);
  const stop = useServerFn(stopWarmup);
  const flag = useServerFn(flagWarmup);
  const ack = useServerFn(acknowledgeWarmupFlag);
  const addAccount = useServerFn(addEmailAccount);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    try { const r = await list(); setAccounts(r.accounts); } catch {}
  };
  useEffect(() => { refresh(); }, []);

  const eligible = accounts.filter((a) => a.warmup_status === "idle" || a.warmup_status === "spammed");
  const warming = accounts.filter((a) => a.warmup_status === "warming").length;
  const canStart = Math.max(0, 20 - warming);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const onStart = async () => {
    if (selected.size === 0) return toast.error("Pick at least one inbox");
    if (selected.size > canStart) return toast.error(`You can only warm up ${canStart} more inbox(es) right now`);
    setBusy(true);
    try {
      const r = await start({ data: { account_ids: Array.from(selected) } });
      toast.success(`Warm-up started for ${r.started} inbox(es). Ramp-up takes 7 days.`);
      setSelected(new Set());
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed to start warm-up"); }
    finally { setBusy(false); }
  };

  const onStop = async (id: string) => {
    if (!confirm("Stop warm-up for this inbox? Daily limit will restore to target.")) return;
    await stop({ data: { account_id: id } }).catch((e: any) => toast.error(e?.message));
    refresh();
  };

  const onClearFlag = async (id: string) => {
    await flag({ data: { account_id: id, status: "idle" } }).catch((e: any) => toast.error(e?.message));
    refresh();
  };

  return (
    <Card className="p-6 bg-card space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2"><Flame className="w-4 h-4" /> Inbox warm-up</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gradually ramps daily volume across a 7-day plan ({RAMP.join(" → ")}) so mailbox providers trust your domain.
            After the ramp, we lift the cap to your target and mark the inbox <strong>Ready</strong> for full-speed sending.
            You can warm up to <strong>20 inboxes</strong> at a time. Currently warming: <strong>{warming}/20</strong>.
          </p>
        </div>
        <Button size="sm" onClick={onStart} disabled={busy || selected.size === 0}>
          <Play className="w-4 h-4 mr-1" />Start warm-up ({selected.size})
        </Button>
      </div>

      {eligible.length > 0 && (
        <div className="rounded-lg border border-border divide-y">
          {eligible.map((a) => (
            <label key={a.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30">
              <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.from_email}</div>
                <div className="text-xs text-muted-foreground">{a.provider} · target {a.daily_limit}/day</div>
              </div>
              {statusBadge(a.warmup_status)}
            </label>
          ))}
        </div>
      )}

      {accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">Add a sending account first, then start warm-up.</p>
      )}

      {(warming > 0 || accounts.some((a) => ["ready", "spammed", "burned"].includes(a.warmup_status))) && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active & completed</div>
          {accounts
            .filter((a) => a.warmup_status !== "idle")
            .map((a) => {
              const pct = Math.round(((a.warmup_day || 0) / 7) * 100);
              const left = daysLeft(a.warmup_day || 0);
              return (
                <div key={a.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.from_email}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.warmup_status === "warming" && <>Day {a.warmup_day}/7 · sending up to {a.warmup_current_limit}/day · <strong>{left} day{left === 1 ? "" : "s"} left</strong></>}
                        {a.warmup_status === "ready" && <>Warmed up · lifted to {a.warmup_target_limit}/day</>}
                        {(a.warmup_status === "spammed" || a.warmup_status === "burned") && <>{a.warmup_flag_reason || a.warmup_status}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(a.warmup_status)}
                      {a.warmup_status === "warming" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onStop(a.id)}><Square className="w-4 h-4" /></Button>
                      )}
                      {(a.warmup_status === "spammed" || a.warmup_status === "burned") && (
                        <Button size="sm" variant="outline" onClick={() => onClearFlag(a.id)}>Clear flag</Button>
                      )}
                    </div>
                  </div>
                  {a.warmup_status === "warming" && (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </Card>
  );
}

// Dashboard alert — surfaces spammed/burned inboxes prominently
export function WarmupAlert() {
  const list = useServerFn(listWarmupStatus);
  const ack = useServerFn(acknowledgeWarmupFlag);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { list().then((r) => setRows(r.accounts ?? [])).catch(() => {}); }, []);
  const flagged = rows.filter((a) => (a.warmup_status === "spammed" || a.warmup_status === "burned") && !a.warmup_acknowledged_at);
  if (flagged.length === 0) return null;
  return (
    <Card className="p-4 border-red-500/40 bg-red-500/5 mb-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Inbox deliverability alert</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {flagged.length} inbox{flagged.length === 1 ? "" : "es"} flagged. Pause sending and review before campaigns land in spam.
          </div>
          <ul className="mt-2 space-y-1">
            {flagged.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">
                  <strong>{a.from_email}</strong> · {statusBadge(a.warmup_status)} <span className="text-muted-foreground">{a.warmup_flag_reason}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={async () => {
                  await ack({ data: { account_id: a.id } }); setRows((rs) => rs.filter((r) => r.id !== a.id));
                }}>Dismiss</Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
