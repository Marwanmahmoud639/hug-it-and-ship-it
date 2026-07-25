import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Infinity as InfinityIcon, Mail, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const SUPPORT_EMAIL = "support@reach4dollars.com";

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

  const supportSubject = encodeURIComponent(`Credit top-up request · Team ${team?.name ?? ""}`);
  const supportBody = encodeURIComponent(
    `Hi,\n\nI'd like to add more credits to my account.\n\nTeam: ${team?.name ?? ""}\nTeam ID: ${team?.id ?? ""}\nCurrent plan: ${(team as any)?.plan ?? "—"}\nCredits used: ${used.toLocaleString()} / ${total.toLocaleString()}\n\nThanks!`,
  );

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

      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2 font-semibold">
          <TrendingUp className="w-4 h-4" /> Need more credits?
        </div>
        <p className="text-sm text-muted-foreground">
          Contact support to top up your balance or upgrade your plan. Include your team name and how many extra credits you need.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button asChild>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${supportSubject}&body=${supportBody}`}>
              <Mail className="w-4 h-4 mr-2" /> Contact support
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
}
