import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function DiscoveryCreditsBadge() {
  const { team } = useAuth();
  const [used, setUsed] = useState<number | null>(null);
  const limit = (team as any)?.discovery_monthly_limit ?? 1000;

  useEffect(() => {
    if (!team?.id) return;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    let cancelled = false;
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
      .eq("source", "discovery")
      .gte("created_at", start.toISOString())
      .then(({ count }) => { if (!cancelled) setUsed(count ?? 0); });
    return () => { cancelled = true; };
  }, [team?.id]);

  if (!team?.id) return null;
  const remaining = Math.max(0, limit - (used ?? 0));
  const pct = limit > 0 ? Math.min(100, ((used ?? 0) / limit) * 100) : 0;
  const tone = pct >= 100 ? "text-red-500 border-red-500/40 bg-red-500/10"
    : pct >= 80 ? "text-amber-500 border-amber-500/40 bg-amber-500/10"
    : "text-primary border-primary/30 bg-primary/10";

  return (
    <Link
      to="/discovery"
      className={cn(
        "hidden md:flex items-center gap-2 h-10 px-3 rounded-lg border text-xs font-medium transition-colors hover:brightness-110",
        tone,
      )}
      title={`Discovery records used this month: ${used ?? "…"} of ${limit}`}
    >
      <Sparkles className="w-3.5 h-3.5" />
      <div className="flex flex-col leading-tight">
        <span className="font-semibold">{remaining.toLocaleString()} left</span>
        <span className="text-[10px] opacity-70">{(used ?? 0).toLocaleString()} / {limit.toLocaleString()} records</span>
      </div>
    </Link>
  );
}
