import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell/ui-bits";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, MessageSquare, Building2, Inbox, PhoneCall, Sparkles, Loader2, CheckCircle2, XCircle, Linkedin, Instagram, Facebook, Twitter, Youtube, Pencil, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactNotes } from "@/components/contacts/contact-notes";
import { CallHistoryList } from "@/components/contacts/call-history-list";
import { ContactTasks } from "@/components/contacts/contact-tasks";
import { useCalling } from "@/components/calling/calling-provider";
import { useServerFn } from "@tanstack/react-start";
import { verifyDecisionMaker } from "@/lib/verify-dm.functions";
import { listAgents, startCall as startAiCall } from "@/lib/voice-agent.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contacts/$id")({ component: ContactDetail });

function ContactDetail() {
  const { id } = Route.useParams();
  const { team } = useAuth();
  const { startCall } = useCalling();
  const [contact, setContact] = useState<any>(null);
  const [phones, setPhones] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [verifying, setVerifying] = useState(false);
  const verifyFn = useServerFn(verifyDecisionMaker);

  const loadContact = async () => {
    if (!team?.id) return;
    const [{ data: c }, { data: p }, { data: e }, { data: m }, { data: a }] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).eq("team_id", team.id).maybeSingle(),
      supabase.from("contact_phones").select("*").eq("contact_id", id).order("confidence_score", { ascending: false }),
      supabase.from("contact_emails").select("*").eq("contact_id", id),
      supabase.from("messages").select("*").eq("contact_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("activity_log").select("*").eq("contact_id", id).order("created_at", { ascending: false }).limit(30),
    ]);
    setContact(c); setPhones(p ?? []); setEmails(e ?? []); setMessages(m ?? []); setActivity(a ?? []);
  };

  useEffect(() => { loadContact(); }, [team?.id, id]);

  const runVerify = async () => {
    setVerifying(true);
    try {
      const r = await verifyFn({ data: { contactId: id } });
      toast.success(`AI verification complete · email ${r.email.confidence}/100${r.icp.score != null ? ` · ICP ${r.icp.score}/100` : ""}`);
      await loadContact();
    } catch (e: any) {
      toast.error(e?.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };


  if (!contact) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto page-in pb-24">
      <Link to="/contacts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to contacts
      </Link>
      <PageHeader title={contact.name || "Untitled contact"} subtitle={[contact.title, contact.company].filter(Boolean).join(" · ")}>
        <Badge variant="secondary">Score {contact.lead_score}</Badge>
        <Button size="sm" variant="outline" onClick={runVerify} disabled={verifying}>
          {verifying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {verifying ? "Verifying…" : "Verify with AI"}
        </Button>
        <Link to="/inbox"><Button size="sm"><Inbox className="w-4 h-4 mr-1" /> Open in inbox</Button></Link>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Conversation history</h3>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : messages.map((m) => (
              <div key={m.id} className="border-b border-border last:border-0 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{m.channel}</Badge>
                  <span>{m.direction}</span>
                  <span>· {new Date(m.created_at).toLocaleString()}</span>
                </div>
                {m.subject && <div className="font-medium text-sm mt-1">{m.subject}</div>}
                <div className="text-sm whitespace-pre-wrap mt-0.5">{m.body}</div>
              </div>
            ))}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Activity</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : activity.map((a) => (
              <div key={a.id} className="text-sm py-1.5 border-b border-border last:border-0">
                <span className="font-medium">{a.action}</span>
                {a.note && <span className="text-muted-foreground"> — {a.note}</span>}
                <span className="text-xs text-muted-foreground ml-2">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Verification</h3>
            {!contact.ai_verified_at ? (
              <p className="text-sm text-muted-foreground">Not yet verified. Click <span className="font-medium">Verify with AI</span> above to run the Claude sub-agents (email validity + ICP fit).</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    {contact.email_verified_by_ai ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
                    <span className="font-medium">Email</span>
                    <Badge variant="outline" className="text-[10px]">{contact.email_ai_confidence ?? 0}/100</Badge>
                  </div>
                  {contact.email_ai_reason && <p className="text-xs text-muted-foreground mt-1">{contact.email_ai_reason}</p>}
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    {contact.icp_matches == null ? (
                      <Badge variant="secondary" className="text-[10px]">ICP not configured</Badge>
                    ) : (
                      <>
                        {contact.icp_matches ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-amber-500" />}
                        <span className="font-medium">ICP Fit</span>
                        <Badge variant="outline" className={`text-[10px] ${(contact.icp_fit_score ?? 0) >= 70 ? "border-emerald-500/40 text-emerald-500" : ""}`}>{contact.icp_fit_score ?? 0}/100</Badge>
                      </>
                    )}
                  </div>
                  {contact.icp_fit_reason && <p className="text-xs text-muted-foreground mt-1">{contact.icp_fit_reason}</p>}
                </div>
                <p className="text-[10px] text-muted-foreground">Last verified {new Date(contact.ai_verified_at).toLocaleString()}</p>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> Details</h3>
            <dl className="text-sm space-y-1.5">
              {contact.company && <div><dt className="text-muted-foreground inline">Company:</dt> <dd className="inline">{contact.company}</dd></div>}
              {contact.industry && <div><dt className="text-muted-foreground inline">Industry:</dt> <dd className="inline">{contact.industry}</dd></div>}
              {(contact.city || contact.state) && <div><dt className="text-muted-foreground inline">Location:</dt> <dd className="inline">{[contact.city, contact.state].filter(Boolean).join(", ")}</dd></div>}
              {contact.source && <div><dt className="text-muted-foreground inline">Source:</dt> <dd className="inline">{contact.source}</dd></div>}
            </dl>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Phone className="w-4 h-4" /> Phones</h3>
              {phones.length > 0 && <AiCallerButton phoneNumber={phones[0].phone_number} contactId={id} />}
            </div>
            {phones.length === 0 ? <p className="text-sm text-muted-foreground">None</p> :
              phones.map((p) => (
                <div key={p.id} className="text-sm py-1 border-b border-border last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => startCall(p.phone_number, id)}
                      className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <PhoneCall className="w-3.5 h-3.5" /> {p.phone_number}
                    </button>
                    <Badge variant="outline" className="text-[10px]">{p.line_type ?? "unknown"} · {p.confidence_score}</Badge>
                  </div>
                </div>
              ))}
          </Card>

          <SocialProfilesCard contact={contact} contactId={id} teamId={team?.id} onSaved={loadContact} />

          <ContactNotes contactId={id} />
          <ContactTasks contactId={id} />
          <CallHistoryList contactId={id} />

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Mail className="w-4 h-4" /> Emails</h3>
            {emails.length === 0 ? <p className="text-sm text-muted-foreground">None</p> :
              emails.map((e) => (
                <div key={e.id} className="text-sm py-1 border-b border-border last:border-0">
                  <div className="flex items-center justify-between">
                    <span>{e.email}</span>
                    <Badge variant="outline" className="text-[10px]">{e.verified_status}</Badge>
                  </div>
                </div>
              ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

type SocialField = { key: "linkedin_url" | "instagram_url" | "facebook_url" | "twitter_url" | "youtube_url"; label: string; Icon: typeof Linkedin };
const SOCIAL_FIELDS: SocialField[] = [
  { key: "linkedin_url", label: "LinkedIn", Icon: Linkedin },
  { key: "instagram_url", label: "Instagram", Icon: Instagram },
  { key: "facebook_url", label: "Facebook", Icon: Facebook },
  { key: "twitter_url", label: "Twitter / X", Icon: Twitter },
  { key: "youtube_url", label: "YouTube", Icon: Youtube },
];

function SocialProfilesCard({
  contact,
  contactId,
  teamId,
  onSaved,
}: {
  contact: any;
  contactId: string;
  teamId: string | undefined;
  onSaved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() =>
    Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, contact[f.key] ?? ""])) as Record<SocialField["key"], string>,
  );

  useEffect(() => {
    setForm(Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, contact[f.key] ?? ""])) as Record<SocialField["key"], string>);
  }, [contact]);

  const save = async () => {
    if (!teamId) return;
    setSaving(true);
    const patch = Object.fromEntries(
      SOCIAL_FIELDS.map((f) => [f.key, form[f.key].trim() || null]),
    ) as { [K in SocialField["key"]]: string | null };
    const { error } = await supabase.from("contacts").update(patch).eq("id", contactId).eq("team_id", teamId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Socials updated");
    setEditing(false);
    await onSaved();
  };

  const filled = SOCIAL_FIELDS.filter((f) => (contact[f.key] ?? "").trim?.());

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Linkedin className="w-4 h-4" /> Social profiles</h3>
        {!editing ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Save
            </Button>
          </div>
        )}
      </div>

      {!editing ? (
        filled.length === 0 ? (
          <p className="text-sm text-muted-foreground">No social profiles on file. Click <span className="font-medium">Edit</span> to add.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {filled.map((f) => {
              const url = contact[f.key] as string;
              const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
              return (
                <li key={f.key} className="flex items-center gap-2">
                  <f.Icon className="w-4 h-4 text-muted-foreground" />
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{url}</a>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <div className="space-y-2.5">
          {SOCIAL_FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="text-xs flex items-center gap-1.5"><f.Icon className="w-3.5 h-3.5" /> {f.label}</Label>
              <Input
                value={form[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder="Add handle or full URL"
                className="h-9"
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AiCallerButton({ phoneNumber, contactId }: { phoneNumber: string; contactId: string }) {
  const listAgentsFn = useServerFn(listAgents);
  const startAi = useServerFn(startAiCall);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const agents = (await listAgentsFn()) as any[];
      const active = agents.find((a: any) => a.status === "active") ?? agents[0];
      if (!active) { toast.error("Create an AI caller first in AI Caller → New agent"); return; }
      await startAi({ data: { agent_id: active.id, contact_id: contactId, phone_number: phoneNumber } });
      toast.success(`${active.name} queued this contact`);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Button size="sm" variant="outline" onClick={go} disabled={busy}>
      {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />} Call with AI
    </Button>
  );
}
