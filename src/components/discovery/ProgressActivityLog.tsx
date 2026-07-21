import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  search_id: string;
  step: string;
  status: string;
  icon: string | null;
  message: string;
  count: number | null;
  percent: number | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  success: "text-emerald-400",
  running: "text-amber-400",
  error: "text-red-400",
  info: "text-muted-foreground",
};

const STEP_LABELS: Record<string, string> = {
  start: "Starting",
  business: "Searching directories",
  decisionmakers: "Identifying decision-makers",
  social: "Fetching social profiles",
  skiptrace: "Skip-tracing",
  verify: "Verifying contacts",
  score: "Scoring leads",
  finalize: "Finalizing",
  error: "Error",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour12: false });
}

export function ProgressActivityLog({
  searchId,
  searchStatus,
}: {
  searchId: string;
  searchStatus?: string | null;
}) {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDone = searchStatus === "complete" || searchStatus === "partial" || searchStatus === "failed";

  const { data: activity = [] } = useQuery<Activity[]>({
    queryKey: ["search_activity", searchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("search_activity")
        .select("*")
        .eq("search_id", searchId)
        .order("created_at", { ascending: true });
      return (data as Activity[]) || [];
    },
    // Polling fallback in case Realtime drops a message while the search is running.
    refetchInterval: isDone ? false : 2000,
  });

  useEffect(() => {
    if (!searchId) return;
    const ch = supabase
      .channel(`search-activity-${searchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "search_activity", filter: `search_id=eq.${searchId}` },
        () => qc.invalidateQueries({ queryKey: ["search_activity", searchId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [searchId, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activity.length]);

  const latestPercent = [...activity].reverse().find((a) => typeof a.percent === "number")?.percent ?? 0;
  const percent = isDone ? 100 : latestPercent;
  const latest = activity[activity.length - 1];
  const stepLabel = latest ? STEP_LABELS[latest.step] ?? latest.step : "Initializing";
  const statusText = isDone
    ? searchStatus === "failed"
      ? "Search failed"
      : "Search complete"
    : `${stepLabel}… ${percent}% complete`;

  return (
    <Card className="p-5 space-y-3 card-hover-lift">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" style={{ fontFamily: "Sora" }}>
          Live Progress
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      <div className="text-sm text-foreground/90">{statusText}</div>
      <Progress value={percent} className="h-3" />
      <div
        ref={scrollRef}
        className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border bg-background/40 p-3 font-mono text-xs space-y-1"
      >
        {activity.length === 0 && (
          <div className="text-muted-foreground">Waiting for activity…</div>
        )}
        {activity.map((a) => (
          <div key={a.id} className="flex items-start gap-2">
            <span className="text-muted-foreground tabular-nums shrink-0">[{fmtTime(a.created_at)}]</span>
            <span className="shrink-0">{a.icon || "•"}</span>
            <span className={cn("flex-1 break-words", STATUS_COLORS[a.status] || STATUS_COLORS.info)}>
              {a.message}
              {typeof a.count === "number" && (
                <span className="text-muted-foreground"> ({a.count.toLocaleString()})</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
