import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function DiscoveryCreditsBadge() {
  const { team } = useAuth();
  if (!team?.id) return null;

  const total = Number((team as any)?.credits_total ?? 100);
  const used = Number((team as any)?.credits_used ?? 0);
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const tone =
    pct >= 100 ? "text-red-500 border-red-500/40 bg-red-500/10"
    : pct >= 90 ? "text-amber-500 border-amber-500/40 bg-amber-500/10"
    : "text-primary border-primary/30 bg-primary/10";

  return (
    <Link
      to="/pricing"
      className={cn(
        "hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-medium leading-none whitespace-nowrap transition-colors hover:brightness-110",
        tone,
      )}
      title={`Credits used this cycle: ${used.toLocaleString()} of ${total.toLocaleString()} · 1 credit = 1 contact, skip trace, or email`}
    >
      <Sparkles className="w-3.5 h-3.5 shrink-0" />
      <span className="font-semibold">{remaining.toLocaleString()}</span>
      <span className="opacity-70">/ {total.toLocaleString()} credits</span>
    </Link>
  );
}
