import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, memo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Sparkles, Megaphone, Mail, MessageSquare, Linkedin, Instagram, Facebook, MoreHorizontal, Rocket, Loader2 } from "lucide-react";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useServerFn } from "@tanstack/react-start";
import { scaleCampaign } from "@/lib/scale-campaign.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campaigns")({ component: Campaigns });

type Campaign = {
  id: string; name: string; type: string; status: string; created_at: string;
  delivery_rate?: number | null; reply_rate?: number | null;
  contact_count?: number | null;
  pause_reason?: string | null; paused_at?: string | null;
  cost_per_lead_threshold?: number | null;
  campaign_round?: number | null; parent_campaign_id?: string | null;
};

const TYPE_META: Record<string, { Icon: any; color: string }> = {
  email: { Icon: Mail, color: "text-blue-400 bg-blue-500/15" },
  sms: { Icon: MessageSquare, color: "text-emerald-400 bg-emerald-500/15" },
  linkedin: { Icon: Linkedin, color: "text-blue-500 bg-blue-600/15" },
  instagram: { Icon: Instagram, color: "text-pink-400 bg-pink-500/15" },
  facebook: { Icon: Facebook, color: "text-cyan-400 bg-cyan-500/15" },
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  completed: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

function Campaigns() {
  const { team, role } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!team?.id) return;
    const { data } = await supabase.from("campaigns").select("*").eq("team_id", team.id).order("created_at", { ascending: false });
    setCampaigns((data ?? []) as Campaign[]);
  };
  useEffect(() => { load(); }, [team?.id]);

  const canEdit = !!role; // any team member (admin or agent) can create/send campaigns

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto page-in">
      <PageHeader title="Campaigns" subtitle="Multichannel outreach orchestration.">
        {canEdit && (
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />New Campaign</Button>
        )}
      </PageHeader>

      <CampaignWizard open={open} onOpenChange={setOpen} onSaved={load} />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          body="Spin up your first outreach sequence to start filling the pipeline."
          action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Create campaign</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map(c => <CampaignCard key={c.id} c={c} onScaled={load} />)}
        </div>
      )}
    </div>
  );
}

const CampaignCard = memo(function CampaignCard({ c, onScaled }: { c: Campaign; onScaled: () => void }) {
  const meta = TYPE_META[c.type] ?? TYPE_META.email;
  const statusClass = STATUS_STYLE[c.status] ?? STATUS_STYLE.draft;
  const delivery = Math.round((c.delivery_rate ?? 0) * 100);
  const reply = Math.round((c.reply_rate ?? 0) * 100);
  const isCompleted = !!c.pause_reason?.startsWith("Completed");
  const goodPerf = (c.reply_rate ?? 0) > 0.03;
  const showScaleCTA = isCompleted && goodPerf;
  const round = c.campaign_round ?? 1;
  const scaleFn = useServerFn(scaleCampaign);
  const [scaling, setScaling] = useState(false);

  const handleScale = async () => {
    setScaling(true);
    try {
      const res = await scaleFn({ data: { campaignId: c.id } });
      toast.success(`Auto-uploaded ${res.added.toLocaleString()} records. Sending now…`);
      onScaled();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to scale campaign");
    } finally {
      setScaling(false);
    }
  };

  return (
    <Card className="group p-5 card-hover-lift relative">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate" style={{ fontFamily: "Sora" }}>{c.name}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize", meta.color)}>
              <meta.Icon className="w-3 h-3" />{c.type}
            </span>
            <Badge className={cn("border text-[10px] capitalize", statusClass)}>{c.status}</Badge>
            {round > 1 && (
              <Badge variant="outline" className="text-[10px]">Round {round}</Badge>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-accent" aria-label="More">
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/review/$id" params={{ id: c.id }}>Personalize & Review</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showScaleCTA ? (
        <div className="mt-3 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-200 space-y-2">
          <div>
            <div className="font-semibold text-emerald-300">🎉 Completed with {reply}% reply rate</div>
            <div className="text-emerald-200/80 mt-0.5">Ready to scale? Upload 5K more records?</div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 text-[11px]" onClick={handleScale} disabled={scaling}>
              {scaling ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Rocket className="w-3 h-3 mr-1" />}
              Yes, Auto-Upload & Send
            </Button>
            <Link to="/review/$id" params={{ id: c.id }}>
              <Button size="sm" variant="outline" className="h-7 text-[11px]">View Results</Button>
            </Link>
          </div>
        </div>
      ) : c.status === "paused" && c.pause_reason && (
        <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
          <span className="font-semibold">Auto-paused:</span> {c.pause_reason}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        <ProgressRow label="Delivery rate" pct={delivery} color="bg-blue-500" />
        <ProgressRow label="Reply rate" pct={reply} color="bg-emerald-500" />
      </div>

      <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/60">
        <span className="text-[11px] text-muted-foreground">
          {(c.contact_count ?? 0).toLocaleString()} contacts · {new Date(c.created_at).toLocaleDateString()}
        </span>
        <Link to="/review/$id" params={{ id: c.id }}>
          <Button size="sm" variant="ghost" className="text-primary"><Sparkles className="w-3 h-3 mr-1" />Review</Button>
        </Link>
      </div>
    </Card>
  );
});

function ProgressRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
