import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import {
  Users, Mail, MessageSquare, Reply, CheckCircle2, Percent,
  Sparkles, Linkedin, Instagram, Facebook, Phone,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function greet() {
  const h = new Date().getHours();
  return h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function channelStyle(t: string): { Icon: any; bg: string; text: string } {
  const k = (t || "").toLowerCase();
  if (k.includes("email")) return { Icon: Mail, bg: "bg-blue-500/15", text: "text-blue-400" };
  if (k.includes("sms") || k.includes("phone")) return { Icon: Phone, bg: "bg-emerald-500/15", text: "text-emerald-400" };
  if (k.includes("linkedin")) return { Icon: Linkedin, bg: "bg-blue-600/15", text: "text-blue-500" };
  if (k.includes("instagram")) return { Icon: Instagram, bg: "bg-pink-500/15", text: "text-pink-400" };
  if (k.includes("facebook")) return { Icon: Facebook, bg: "bg-cyan-500/15", text: "text-cyan-400" };
  return { Icon: Sparkles, bg: "bg-violet-500/15", text: "text-violet-400" };
}

function Dashboard() {
  const { team, profile } = useAuth();
  const [stats, setStats] = useState({ contacts: 0, emails: 0, sms: 0, replies: 0 });
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!team?.id) return;
    Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("team_id", team.id),
      supabase.from("campaign_contacts").select("id", { count: "exact", head: true }).eq("team_id", team.id).not("sent_at", "is", null),
      supabase.from("activity_log").select("*").eq("team_id", team.id).order("created_at", { ascending: false }).limit(15),
    ]).then(([c, sent, log]) => {
      setStats(s => ({ ...s, contacts: c.count ?? 0, emails: sent.count ?? 0 }));
      setActivity(log.data ?? []);
    });
  }, [team?.id]);

  const spark = [4, 8, 6, 10, 14, 12, 18];
  const firstName = (profile?.name || profile?.email || "").split(/[\s@]/)[0];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto page-in">
      <PageHeader title="Dashboard" greeting={`${greet()}${firstName ? `, ${firstName}` : ""}. Command your pipeline at a glance.`} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard accent="blue"    label="Total Prospects" value={stats.contacts} trend={12.4} spark={spark}            icon={<Users className="w-5 h-5" />} />
        <StatCard accent="violet"  label="Emails Sent"     value={stats.emails}   trend={8.1}  spark={spark}            icon={<Mail className="w-5 h-5" />} />
        <StatCard accent="emerald" label="SMS Sent"        value={stats.sms}      trend={-3.2} spark={[6,4,5,3,2,4,3]}  icon={<MessageSquare className="w-5 h-5" />} />
        <StatCard accent="amber"   label="Responses"       value={stats.replies}  trend={5.6}  spark={spark}            icon={<Reply className="w-5 h-5" />} />
        <StatCard accent="cyan"    label="Delivery Rate"   value="—"              icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard accent="pink"    label="Response Rate"   value="—"              icon={<Percent className="w-5 h-5" />} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 card-hover-lift">
          <h3 className="font-semibold mb-3" style={{ fontFamily: "Sora" }}>Needs Attention</h3>
          <EmptyState
            icon={CheckCircle2}
            title="All clear — no items need attention"
            body="Pipeline health, cold leads, and delivery issues will surface here."
            size="sm"
          />
        </Card>

        <Card className="p-5 card-hover-lift">
          <h3 className="font-semibold mb-3" style={{ fontFamily: "Sora" }}>Recent Activity</h3>
          {activity.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No activity yet"
              body="Launch a campaign or import contacts to see activity here."
              size="sm"
              action={<Button variant="outline" size="sm" asChild><a href="/campaigns">Start a campaign</a></Button>}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {activity.map((a, i) => {
                const { Icon, bg, text } = channelStyle(a.channel || a.type || a.action || "");
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-md hover:bg-accent/40 transition-colors"
                    style={{ animation: `pageIn 360ms ease-out both`, animationDelay: `${i * 50}ms` }}
                  >
                    <span className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", bg)}>
                      <Icon className={cn("w-4 h-4", text)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">
                        {a.entity_name && <span className="font-semibold">{a.entity_name}</span>}
                        {a.entity_name && <span className="text-muted-foreground"> — </span>}
                        <span className={a.entity_name ? "text-muted-foreground" : ""}>{a.action}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
