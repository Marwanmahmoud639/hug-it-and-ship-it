import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, TrendingUp, Trophy, GraduationCap } from "lucide-react";
import { getIntelligenceOverview } from "@/lib/intelligence.functions";

export const Route = createFileRoute("/_app/intelligence")({ component: Intelligence });

function Intelligence() {
  const [days, setDays] = useState("30");

  return (
    <div className="h-full overflow-auto">
      <PageHeader
        title="Intelligence"
        subtitle="What the system knows: volume, outcomes, and which copy is actually earning replies."
      />
      <div className="p-4 md:p-6">
        <Tabs defaultValue="kpis">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="performance">Top Performers</TabsTrigger>
              <TabsTrigger value="coaching">Coaching</TabsTrigger>
            </TabsList>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="kpis" className="mt-4"><Kpis days={Number(days)} /></TabsContent>
          <TabsContent value="performance" className="mt-4"><TopPerformers days={Number(days)} /></TabsContent>
          <TabsContent value="coaching" className="mt-4"><Coaching /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** Renders a rate that may legitimately have no denominator yet. */
function Rate({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-base font-normal">No data yet</span>;
  return <>{value}%</>;
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function Kpis({ days }: { days: number }) {
  const fn = useServerFn(getIntelligenceOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["intelligence", days],
    queryFn: () => fn({ data: { days } }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">In the system</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Stat label="Contacts" value={data.totals.contacts.toLocaleString()} sub={`+${data.totals.contactsNew} in ${days}d`} />
          <Stat label="Discovery searches" value={data.totals.searches.toLocaleString()} sub={`${data.totals.searchesRecent} in ${days}d`} />
          <Stat label="Campaigns" value={data.totals.campaigns.toLocaleString()} />
          <Stat label="Saved templates unused" value={data.templates.unused.toLocaleString()} sub="Never sent" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Outreach — last {days} days</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Stat label="Emails sent" value={data.outreach.emailsSent.toLocaleString()} />
          <Stat label="Email reply rate" value={<Rate value={data.outreach.emailReplyRate} />} sub={`${data.outreach.emailsReplied} replied`} />
          <Stat label="SMS sent" value={data.outreach.smsSent.toLocaleString()} />
          <Stat label="Call connect rate" value={<Rate value={data.outreach.callConnectRate} />} sub={`${data.outreach.callsConnected} of ${data.outreach.callsTotal}`} />
        </div>
      </div>
    </div>
  );
}

function TopPerformers({ days }: { days: number }) {
  const fn = useServerFn(getIntelligenceOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["intelligence", days],
    queryFn: () => fn({ data: { days } }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const top = data?.templates.topPerforming ?? [];

  if (top.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Not enough sends to rank yet"
        body={`Templates need at least ${data?.templates.minSendsToRank ?? 5} sends before they appear here — ranking on one or two replies would be noise, not signal.`}
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-3">Template</th>
            <th className="p-3">Type</th>
            <th className="p-3">Sent</th>
            <th className="p-3">Reply rate</th>
            <th className="p-3">Converted</th>
          </tr>
        </thead>
        <tbody>
          {top.map((t: any, i: number) => (
            <tr key={t.id} className="border-t border-border">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {i === 0 && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                  <span className="font-medium">{t.name}</span>
                </div>
                {t.industry && <div className="text-xs text-muted-foreground">{t.industry}</div>}
              </td>
              <td className="p-3">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {t.platform ?? t.kind.replace("_", " ")}
                </Badge>
              </td>
              <td className="p-3">{t.times_used}</td>
              <td className="p-3 font-medium">{t.response_rate}%</td>
              <td className="p-3">{t.times_converted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Coaching() {
  return (
    <EmptyState
      icon={GraduationCap}
      title="AI coaching"
      body="Voice roleplay for cold calls and written feedback on email/SMS drafts, tuned to the lead's industry. Builds on the objection extraction the AI caller already performs on call transcripts."
    />
  );
}
