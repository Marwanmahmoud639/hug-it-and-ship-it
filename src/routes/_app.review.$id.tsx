import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RefreshCw, Check, Sparkles, Send } from "lucide-react";
import {
  generatePersonalizations, approvePersonalization,
  regeneratePersonalization, bulkApprove,
} from "@/lib/personalization.functions";

export const Route = createFileRoute("/_app/review/$id")({
  component: ReviewPage,
});

function ReviewPage() {
  const { id: campaignId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const genFn = useServerFn(generatePersonalizations);
  const approveFn = useServerFn(approvePersonalization);
  const regenFn = useServerFn(regeneratePersonalization);
  const bulkFn = useServerFn(bulkApprove);

  const [variant, setVariant] = useState<"initial" | "warm_followup" | "cold_followup">("initial");
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: campaign } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
      return data;
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["ai_jobs", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_personalization_jobs")
        .select("*, contact:contacts(id, name, title, company, industry, city, lead_score, email)")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 3000,
  });

  // realtime
  useEffect(() => {
    const ch = supabase.channel(`ai-jobs-${campaignId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ai_personalization_jobs", filter: `campaign_id=eq.${campaignId}` },
        () => qc.invalidateQueries({ queryKey: ["ai_jobs", campaignId] })
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [campaignId, qc]);

  const filteredJobs = useMemo(() => {
    const v = jobs.filter((j: any) => j.variant === variant);
    if (filter === "all") return v;
    if (filter === "pending") return v.filter((j: any) => j.status !== "approved");
    return v.filter((j: any) => j.status === "approved");
  }, [jobs, filter, variant]);

  const selected = filteredJobs.find((j: any) => j.id === selectedId) || filteredJobs[0];
  useEffect(() => {
    if (selected) setEditText(selected.edited_message ?? selected.generated_message ?? "");
  }, [selected?.id]);

  const approvedCount = jobs.filter((j: any) => j.variant === variant && j.status === "approved").length;
  const totalCount = jobs.filter((j: any) => j.variant === variant).length;

  // Generate for contacts already in campaign
  const generate = useMutation({
    mutationFn: async () => {
      const { data: ccs } = await supabase.from("campaign_contacts")
        .select("contact_id").eq("campaign_id", campaignId);
      const ids = (ccs || []).map((x: any) => x.contact_id);
      if (!ids.length) throw new Error("No contacts attached to this campaign yet.");
      return genFn({ data: { campaignId, contactIds: ids, variant } });
    },
    onSuccess: (r) => toast.success(`Generated ${r.succeeded} (${r.failed} failed) via ${r.provider}`),
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: () => approveFn({ data: { jobId: selected!.id, editedMessage: editText } }),
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["ai_jobs", campaignId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const regen = useMutation({
    mutationFn: () => regenFn({ data: { jobId: selected!.id } }),
    onSuccess: () => { toast.success("Regenerated"); qc.invalidateQueries({ queryKey: ["ai_jobs", campaignId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: (minScore?: number) => bulkFn({ data: { campaignId, ...(minScore != null ? { minScore } : {}) } }),
    onSuccess: (r) => { toast.success(`Approved ${r.approved}`); qc.invalidateQueries({ queryKey: ["ai_jobs", campaignId] }); },
  });

  const launch = useMutation({
    mutationFn: async () => {
      if (approvedCount === 0) throw new Error("Approve at least one message first");
      const { error } = await supabase.from("campaigns").update({ status: "scheduled" }).eq("id", campaignId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Campaign queued for launch"); navigate({ to: "/campaigns" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border p-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link to="/campaigns"><Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" />Back</Button></Link>
          <div>
            <div className="font-semibold">{campaign?.name ?? "Campaign"}</div>
            <div className="text-xs text-muted-foreground">AI Personalization Review · {approvedCount}/{totalCount} approved</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={variant} onValueChange={(v: any) => setVariant(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="initial">Initial</SelectItem>
              <SelectItem value="warm_followup">Warm follow-up</SelectItem>
              <SelectItem value="cold_followup">Cold follow-up</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <Sparkles className="size-4 mr-1" />}
            Generate
          </Button>
          <Button size="sm" variant="secondary" onClick={() => bulk.mutate(undefined)}>Bulk Approve</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk.mutate(80)}>Approve 80+</Button>
          <Button size="sm" onClick={() => launch.mutate()} disabled={approvedCount === 0 || launch.isPending}>
            <Send className="size-4 mr-1" />Launch ({approvedCount})
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] overflow-hidden">
        {/* List */}
        <div className="border-r border-border overflow-auto">
          <div className="p-2 border-b border-border flex gap-1">
            {(["all", "pending", "approved"] as const).map(f => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"} onClick={() => setFilter(f)} className="text-xs capitalize">{f}</Button>
            ))}
          </div>
          {filteredJobs.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No jobs yet. Click <strong>Generate</strong> to personalize messages for the contacts attached to this campaign.
            </div>
          )}
          {filteredJobs.map((j: any) => {
            const c = j.contact || {};
            const score = c.lead_score || 0;
            const sel = (selected?.id === j.id);
            return (
              <button key={j.id} onClick={() => setSelectedId(j.id)}
                className={`w-full text-left p-3 border-b border-border hover:bg-muted/40 ${sel ? "bg-muted/60" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm truncate">{c.name || "—"}</div>
                  <Badge variant="outline" className="text-[10px]">{score}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{c.title} · {c.company}</div>
                <div className="mt-1 flex gap-1">
                  <Badge variant={j.status === "approved" ? "default" : j.status === "generated" ? "secondary" : "outline"} className="text-[10px]">{j.status}</Badge>
                  {j.ai_provider && <Badge variant="outline" className="text-[10px]">{j.ai_provider}</Badge>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <div className="overflow-auto p-6">
          {!selected ? (
            <div className="text-center text-muted-foreground py-20">Select a contact to review their message.</div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold">{selected.contact?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selected.contact?.title} · {selected.contact?.company} · {selected.contact?.city}
                    </div>
                  </div>
                  <Badge>{selected.contact?.lead_score || 0}</Badge>
                </div>
                {selected.error && <div className="text-xs text-destructive mb-2">{selected.error}</div>}
                <Textarea rows={12} value={editText} onChange={(e) => setEditText(e.target.value)}
                  className="font-mono text-sm" placeholder="AI output will appear here…" />
                <div className="flex justify-between items-center mt-3">
                  <div className="text-xs text-muted-foreground">{editText.length} chars</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => regen.mutate()} disabled={regen.isPending}>
                      <RefreshCw className={`size-4 mr-1 ${regen.isPending ? "animate-spin" : ""}`} />Regenerate
                    </Button>
                    <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending || !editText}>
                      <Check className="size-4 mr-1" />Approve
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
