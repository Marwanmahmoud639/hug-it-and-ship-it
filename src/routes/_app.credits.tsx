import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Infinity as InfinityIcon, LifeBuoy, TrendingUp, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { submitSupportRequest, listMySupportRequests } from "@/lib/support.functions";

export const Route = createFileRoute("/_app/credits")({ component: CreditsPage });

function CreditsPage() {
  const { team, isSuperAdmin } = useAuth();

  if (isSuperAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <InfinityIcon className="w-6 h-6 text-primary" /> Unlimited access
          </h1>
          <p className="text-muted-foreground mt-1">
            You are signed in as a super admin. Credit limits, trial caps, and monthly quotas do not apply to your account.
          </p>
        </div>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Discovery, skip trace, email sending, warmup, SMS — all uncapped.</div>
        </Card>
      </div>
    );
  }

  const total = Number((team as any)?.credits_total ?? 0);
  const used = Number((team as any)?.credits_used ?? 0);
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const planStatus = (team as any)?.plan_status ?? "trial";
  const trialEnds = (team as any)?.trial_ends_at ? new Date((team as any).trial_ends_at) : null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> Credits & usage
        </h1>
        <p className="text-muted-foreground mt-1">
          1 credit = 1 discovery contact, 1 skip trace, or 1 email/SMS sent.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-3xl font-bold">{remaining.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">credits remaining</div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {used.toLocaleString()} / {total.toLocaleString()} used
          </div>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="grid grid-cols-2 gap-4 text-sm pt-2">
          <div>
            <div className="text-muted-foreground">Plan</div>
            <div className="font-medium capitalize">{(team as any)?.plan ?? "—"} · {planStatus}</div>
          </div>
          {trialEnds && planStatus === "trial" && (
            <div>
              <div className="text-muted-foreground">Trial ends</div>
              <div className="font-medium">{trialEnds.toLocaleDateString()}</div>
            </div>
          )}
        </div>
      </Card>

      <SupportRequestForm />
      <MyRequestsList />
    </div>
  );
}

function SupportRequestForm() {
  const submit = useServerFn(submitSupportRequest);
  const qc = useQueryClient();
  const [category, setCategory] = useState("credits");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const mut = useMutation({
    mutationFn: async () => submit({ data: { category: category as any, subject, message } }),
    onSuccess: () => {
      toast.success("Request sent — we'll email you back shortly.");
      setSubject("");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["my-support-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send request"),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 font-semibold">
        <LifeBuoy className="w-4 h-4" /> Contact support
      </div>
      <p className="text-sm text-muted-foreground">
        Send us a message directly from the app. We'll email you the response and you'll see it here too.
      </p>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="credits">Credits / top-up</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="technical">Technical issue</SelectItem>
              <SelectItem value="feature">Feature request</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Need 10,000 more credits"
            maxLength={200}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Message</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us how we can help…"
            rows={5}
            maxLength={4000}
          />
        </div>
        <div>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || subject.trim().length < 3 || message.trim().length < 10}
          >
            {mut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : <><TrendingUp className="w-4 h-4 mr-2" /> Send request</>}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MyRequestsList() {
  const list = useServerFn(listMySupportRequests);
  const { data } = useQuery({
    queryKey: ["my-support-requests"],
    queryFn: () => list({ data: {} as any }),
  });
  const rows = (data as any)?.rows ?? [];
  if (!rows.length) return null;
  return (
    <Card className="p-6 space-y-3">
      <div className="font-semibold">Your recent requests</div>
      <div className="space-y-3">
        {rows.map((r: any) => (
          <div key={r.id} className="border rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium truncate">{r.subject}</div>
              <Badge variant={r.status === "resolved" ? "default" : "secondary"} className="capitalize">
                {r.status === "resolved" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                {r.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 capitalize">
              {r.category} · {new Date(r.created_at).toLocaleString()}
            </div>
            {r.admin_response && (
              <div className="mt-2 p-2 bg-muted/50 rounded whitespace-pre-wrap text-sm">
                <div className="text-xs text-muted-foreground mb-1">Support response:</div>
                {r.admin_response}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
