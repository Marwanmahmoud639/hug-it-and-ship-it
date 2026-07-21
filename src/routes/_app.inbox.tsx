import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Inbox as InboxIcon, Sparkles, Send, Mail, MessageSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listConversations, getThread, sendReply, markRead, aiSuggestReply,
} from "@/lib/inbox.functions";

export const Route = createFileRoute("/_app/inbox")({ component: InboxPage });

type Convo = {
  contact_id: string | null;
  channel: "email" | "sms" | "whatsapp";
  unread: number;
  last: any;
  contact: { id: string; name: string; company: string | null; email: string | null; phone: string | null } | null;
};

function InboxPage() {
  const { team } = useAuth();
  const list = useServerFn(listConversations);
  const thread = useServerFn(getThread);
  const send = useServerFn(sendReply);
  const mark = useServerFn(markRead);
  const aiSuggest = useServerFn(aiSuggestReply);

  const [channel, setChannel] = useState<"all" | "email" | "sms" | "whatsapp">("all");
  const [filter, setFilter] = useState<"all" | "unread" | "needs_reply">("all");
  const [q, setQ] = useState("");
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const [messages, setMessages] = useState<any[]>([]);
  const [contact, setContact] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  const loadList = async () => {
    const r: any = await list({ data: { channel, filter, q: q || undefined } });
    setConvos(r.conversations);
  };
  useEffect(() => { loadList(); }, [channel, filter]);
  useEffect(() => {
    const t = setTimeout(loadList, 250);
    return () => clearTimeout(t);
  }, [q]);

  const loadThread = async (id: string, ch: "email" | "sms" | "whatsapp") => {
    setActiveId(id); setActiveChannel(ch); setDraft(""); setSubject(""); setAiSuggested(false);
    const r: any = await thread({ data: { contactId: id } });
    setContact(r.contact); setMessages(r.messages);
    await mark({ data: { contactId: id } });
    loadList();
  };

  // Realtime: any new message refreshes list + active thread
  useEffect(() => {
    if (!team?.id) return;
    const ch = supabase.channel(`inbox-${team.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `team_id=eq.${team.id}` },
        (payload: any) => {
          loadList();
          if (activeId && payload.new.contact_id === activeId) {
            setMessages((m) => [...m, payload.new]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team?.id, activeId]);

  const onSend = async () => {
    if (!activeId || !draft.trim()) return;
    try {
      await send({ data: {
        contactId: activeId, channel: activeChannel,
        subject: activeChannel === "email" ? subject || "Re:" : undefined,
        body: draft, aiSuggested,
      }});
      setDraft(""); setAiSuggested(false);
      toast.success("Reply sent");
      const r: any = await thread({ data: { contactId: activeId } });
      setMessages(r.messages);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    }
  };

  const onAi = async () => {
    if (!activeId) return;
    setAiBusy(true);
    try {
      const r: any = await aiSuggest({ data: { contactId: activeId } });
      if (r.error) toast.error(r.error);
      else { setDraft(r.suggestion); setAiSuggested(true); }
    } finally { setAiBusy(false); }
  };

  const channels = useMemo(() => [
    { v: "all", label: "All", i: InboxIcon },
    { v: "email", label: "Email", i: Mail },
    { v: "sms", label: "SMS", i: MessageSquare },
    { v: "whatsapp", label: "WhatsApp", i: MessageSquare },
  ] as const, []);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto page-in pb-24">
      <PageHeader title="Inbox" subtitle="Two-way conversations across email, SMS, and WhatsApp." />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Tabs value={channel} onValueChange={(v) => setChannel(v as any)}>
          <TabsList>{channels.map((c) => <TabsTrigger key={c.v} value={c.v}>{c.label}</TabsTrigger>)}</TabsList>
        </Tabs>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="needs_reply">Needs reply</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-8 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-280px)] min-h-[500px]">
        <Card className="overflow-y-auto">
          {convos.length === 0 ? (
            <div className="p-6"><EmptyState icon={InboxIcon} title="No conversations" body="Inbound replies will appear here." /></div>
          ) : convos.map((c) => {
            const id = c.contact_id ?? "";
            return (
              <button key={id || c.last.id} onClick={() => id && loadThread(id, c.channel)}
                className={cn("w-full text-left px-3 py-3 border-b border-border hover:bg-muted/40 transition-colors",
                  activeId === id && "bg-muted/60")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{c.contact?.name ?? c.last.from_address ?? "Unknown"}</span>
                  {c.unread > 0 && <Badge className="h-5">{c.unread}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{c.last.body}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] uppercase">{c.channel}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(c.last.created_at).toLocaleString()}</span>
                </div>
              </button>
            );
          })}
        </Card>

        <Card className="flex flex-col overflow-hidden">
          {!activeId ? (
            <div className="m-auto"><EmptyState icon={InboxIcon} title="Select a conversation" body="Pick a thread on the left to read and reply." /></div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-medium">{contact?.name}</div>
                  <div className="text-xs text-muted-foreground">{contact?.company ?? ""} · {activeChannel.toUpperCase()}</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    m.direction === "inbound" ? "bg-muted/60" : "bg-primary/15 ml-auto")}>
                    {m.subject && <div className="font-medium text-xs mb-1">{m.subject}</div>}
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(m.created_at).toLocaleString()}
                      {m.ai_suggested && " · AI-assisted"}
                      {m.is_opt_out_detected && " · OPT-OUT"}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3 space-y-2">
                {aiSuggested && (
                  <div className="text-xs flex items-center gap-2 text-amber-500">
                    <Sparkles className="w-3.5 h-3.5" /> AI-suggested reply — review before sending
                  </div>
                )}
                {activeChannel === "email" && (
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
                )}
                <Textarea value={draft} onChange={(e) => { setDraft(e.target.value); setAiSuggested(false); }}
                  rows={3} placeholder={`Reply via ${activeChannel}…`} />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={onAi} disabled={aiBusy}>
                    <Sparkles className="w-4 h-4 mr-1" /> {aiBusy ? "Thinking…" : "AI suggest"}
                  </Button>
                  <Button size="sm" onClick={onSend} disabled={!draft.trim()} className="ml-auto">
                    <Send className="w-4 h-4 mr-1" /> Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
