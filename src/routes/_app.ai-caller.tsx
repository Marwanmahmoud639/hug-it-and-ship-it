import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAgents, createAgent, updateAgent, deleteAgent,
  listKnowledge, addKnowledgeText, removeKnowledge,
  listObjections, upsertObjection,
  chatWithAgent, saveTrainingSession,
  startCall, updateCall, listCallRuns, getCallStats, learnFromCall,
} from "@/lib/voice-agent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/app-shell/ui-bits";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Mic, MicOff, Volume2, PhoneCall, PhoneOff, Bot, BookOpen, MessageSquare, BarChart3, Sparkles, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ai-caller")({
  head: () => ({
    meta: [
      { title: "AI Caller — automated voice outreach" },
      { name: "description", content: "Train an AI voice caller, upload your knowledge base, review objections, and track every call your agents make." },
      { property: "og:title", content: "AI Caller — automated voice outreach" },
      { property: "og:description", content: "Train an AI voice caller, upload your knowledge base, review objections, and track every call your agents make." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiCallerPage,
});

// Voice presets — free browser voices (Web Speech API) plus premium slots users can wire up later.
const VOICES: Array<{ id: string; name: string; provider: "web_speech" | "elevenlabs" | "openai"; description: string }> = [
  { id: "web-female-us",  name: "Ava (US, Female)",   provider: "web_speech", description: "Free browser voice, warm and natural." },
  { id: "web-male-us",    name: "Ethan (US, Male)",   provider: "web_speech", description: "Free browser voice, calm and confident." },
  { id: "web-female-uk",  name: "Olivia (UK, Female)",provider: "web_speech", description: "Free browser voice, British accent." },
  { id: "web-male-uk",    name: "Oliver (UK, Male)",  provider: "web_speech", description: "Free browser voice, British accent." },
  { id: "web-female-au",  name: "Charlotte (AU)",     provider: "web_speech", description: "Free browser voice, Australian." },
  { id: "alloy",          name: "Alloy (Premium)",    provider: "openai",     description: "Premium neural voice (requires OpenAI/ElevenLabs key)." },
  { id: "verse",          name: "Verse (Premium)",    provider: "openai",     description: "Premium neural voice." },
];

// Preview a voice in the browser using the Web Speech API. Works for the
// `web_speech` presets; for premium slots we still play a sample so users
// can hear the accent/gender they picked before wiring up a paid provider.
function previewVoice(voiceId: string, sample?: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    toast.error("Voice preview isn't supported in this browser.");
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const text = (sample && sample.trim()) ||
      "Hi, this is a quick preview of how I'll sound on your calls.";
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const wantsFemale = voiceId.includes("female");
    const wantsMale = voiceId.includes("male");
    const uk = voiceId.includes("uk");
    const au = voiceId.includes("au");
    u.lang = uk ? "en-GB" : au ? "en-AU" : "en-US";
    const match = voices.find(v =>
      (uk ? v.lang.startsWith("en-GB") : au ? v.lang.startsWith("en-AU") : v.lang.startsWith("en"))
      && (wantsFemale ? /female|samantha|victoria|karen|zira|ava|allison/i.test(v.name)
        : wantsMale ? /male|david|daniel|alex|fred/i.test(v.name) : true)
    ) ?? voices.find(v => v.lang.startsWith("en"));
    if (match) u.voice = match;
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
  } catch {
    toast.error("Couldn't play voice preview.");
  }
}

type Agent = {
  id: string; name: string; description: string | null;
  voice_id: string; voice_provider: string; language: string;
  script: string; system_prompt: string; status: string;
  total_calls: number; total_connected: number; total_converted: number;
  created_at: string;
};

function AiCallerPage() {
  const listAgentsFn = useServerFn(listAgents);
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["voice-agents"],
    queryFn: () => listAgentsFn(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && agents.length > 0) setSelectedId(agents[0].id);
  }, [agents, selectedId]);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border bg-card/40 px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <PhoneCall className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">AI Caller</h1>
            <p className="text-xs text-muted-foreground">Train agents, upload knowledge, and let them dial your pipeline.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder={agents.length ? "Choose an agent" : "No agents yet"} /></SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name} <span className="text-muted-foreground ml-2 text-xs">{a.status}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> New agent</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading agents…</div>
        ) : !selected ? (
          <EmptyState
            icon={Bot}
            title="No AI callers yet"
            body="Create your first AI voice agent — give it a script, a voice, and knowledge, then let it dial leads from your pipeline."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Create AI caller</Button>}
          />
        ) : (
          <AgentWorkspace agent={selected} onRefresh={() => qc.invalidateQueries({ queryKey: ["voice-agents"] })} />
        )}
      </div>

      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(a) => { setSelectedId(a.id); qc.invalidateQueries({ queryKey: ["voice-agents"] }); }} />
    </div>
  );
}

function CreateAgentDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (a: Agent) => void }) {
  const createFn = useServerFn(createAgent);
  const [name, setName] = useState("Cash Offer Caller");
  const [voice, setVoice] = useState(VOICES[0]);
  const [script, setScript] = useState("Hi, this is [Agent] from [Company]. I'm calling to see if you'd consider a fair cash offer on the property at [Address]. Do you have 30 seconds?");
  const [prompt, setPrompt] = useState("You are a friendly, professional AI cold caller for a real-estate investing team. Introduce yourself, listen carefully, handle objections, and try to book a callback with the owner.");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) { toast.error("Give your caller a name"); return; }
    setBusy(true);
    try {
      const a = await createFn({ data: {
        name: name.trim(),
        description: "",
        voice_id: voice.id,
        voice_provider: voice.provider,
        language: "en-US",
        script,
        system_prompt: prompt,
      } });
      toast.success("AI caller created");
      onCreated(a as Agent);
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "Failed to create"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>New AI caller</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cash Offer Caller" /></div>
          <div>
            <Label>Voice</Label>
            <div className="flex items-center gap-2">
              <Select value={voice.id} onValueChange={(v) => setVoice(VOICES.find(x => x.id === v) ?? VOICES[0])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={() => previewVoice(voice.id, script)} title="Play preview">
                <Volume2 className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{voice.description}</p>
          </div>
          <div><Label>Opening script</Label><Textarea rows={3} value={script} onChange={(e) => setScript(e.target.value)} /></div>
          <div><Label>System prompt (how it should behave)</Label><Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AgentWorkspace({ agent, onRefresh }: { agent: Agent; onRefresh: () => void }) {
  return (
    <Tabs defaultValue="agent" className="space-y-4">
      <TabsList>
        <TabsTrigger value="agent"><Bot className="w-4 h-4 mr-1" /> Agent</TabsTrigger>
        <TabsTrigger value="knowledge"><BookOpen className="w-4 h-4 mr-1" /> Knowledge</TabsTrigger>
        <TabsTrigger value="training"><Mic className="w-4 h-4 mr-1" /> Training studio</TabsTrigger>
        <TabsTrigger value="objections"><MessageSquare className="w-4 h-4 mr-1" /> Objections</TabsTrigger>
        <TabsTrigger value="calls"><PhoneCall className="w-4 h-4 mr-1" /> Calls</TabsTrigger>
        <TabsTrigger value="stats"><BarChart3 className="w-4 h-4 mr-1" /> Intelligence</TabsTrigger>
      </TabsList>
      <TabsContent value="agent"><AgentTab agent={agent} onRefresh={onRefresh} /></TabsContent>
      <TabsContent value="knowledge"><KnowledgeTab agent={agent} /></TabsContent>
      <TabsContent value="training"><TrainingStudio agent={agent} /></TabsContent>
      <TabsContent value="objections"><ObjectionsTab agent={agent} /></TabsContent>
      <TabsContent value="calls"><CallsTab agent={agent} /></TabsContent>
      <TabsContent value="stats"><StatsTab agent={agent} /></TabsContent>
    </Tabs>
  );
}

function AgentTab({ agent, onRefresh }: { agent: Agent; onRefresh: () => void }) {
  const updateFn = useServerFn(updateAgent);
  const deleteFn = useServerFn(deleteAgent);
  const [name, setName] = useState(agent.name);
  const [voiceId, setVoiceId] = useState(agent.voice_id);
  const [script, setScript] = useState(agent.script);
  const [prompt, setPrompt] = useState(agent.system_prompt);
  const [status, setStatus] = useState<string>(agent.status);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(agent.name); setVoiceId(agent.voice_id); setScript(agent.script); setPrompt(agent.system_prompt); setStatus(agent.status); }, [agent.id]);

  const save = async () => {
    setBusy(true);
    try {
      const voice = VOICES.find(v => v.id === voiceId) ?? VOICES[0];
      await updateFn({ data: { id: agent.id, patch: { name, voice_id: voice.id, voice_provider: voice.provider, script, system_prompt: prompt, status: status as any } } });
      toast.success("Saved");
      onRefresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };
  const del = async () => {
    if (!confirm("Delete this AI caller and all its data?")) return;
    setBusy(true);
    try { await deleteFn({ data: { id: agent.id } }); toast.success("Deleted"); onRefresh(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>Voice</Label>
          <Select value={voiceId} onValueChange={setVoiceId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Opening script</Label><Textarea rows={4} value={script} onChange={(e) => setScript(e.target.value)} /></div>
      <div><Label>System prompt</Label><Textarea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
      <div className="flex items-center justify-between">
        <Button variant="destructive" onClick={del} disabled={busy}><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
        <Button onClick={save} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save changes</Button>
      </div>
    </Card>
  );
}

function KnowledgeTab({ agent }: { agent: Agent }) {
  const listFn = useServerFn(listKnowledge);
  const addFn = useServerFn(addKnowledgeText);
  const removeFn = useServerFn(removeKnowledge);
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["agent-knowledge", agent.id],
    queryFn: () => listFn({ data: { agent_id: agent.id } }),
  });
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitText = async () => {
    if (!title.trim() || !content.trim()) { toast.error("Title and content required"); return; }
    setBusy(true);
    try { await addFn({ data: { agent_id: agent.id, title: title.trim(), content, kind: "text" } });
      toast.success("Knowledge added"); setTitle(""); setContent("");
      qc.invalidateQueries({ queryKey: ["agent-knowledge", agent.id] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const text = await f.text();
      await addFn({ data: { agent_id: agent.id, title: f.name, content: text.slice(0, 190_000), kind: f.name.toLowerCase().endsWith(".pdf") ? "pdf" : "text" } });
      toast.success("File added");
      qc.invalidateQueries({ queryKey: ["agent-knowledge", agent.id] });
    } catch (e: any) { toast.error(e?.message ?? "Failed to read file"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Teach your AI</div>
        <p className="text-sm text-muted-foreground">Paste a script, FAQ, pricing sheet — or upload a text/PDF file. The AI reads all of this before every call.</p>
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cash offer FAQ" /></div>
        <div><Label>Content</Label><Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste text here…" /></div>
        <div className="flex items-center gap-2">
          <Button onClick={submitText} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save text</Button>
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><FileText className="w-4 h-4 mr-1" /> Upload file</Button>
        </div>
        <p className="text-xs text-muted-foreground">Text/CSV/MD upload extracts inline. PDFs are stored as raw text; for scanned PDFs, paste the text manually.</p>
      </Card>
      <Card className="p-4 space-y-3">
        <div className="font-semibold">Knowledge library ({items.length})</div>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : (
          <div className="space-y-2 max-h-[520px] overflow-auto">
            {items.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between border border-border rounded-md p-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{k.title}</div>
                  <div className="text-xs text-muted-foreground">{k.kind} · ~{k.tokens} tokens · {new Date(k.created_at).toLocaleDateString()}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={async () => { await removeFn({ data: { id: k.id } }); qc.invalidateQueries({ queryKey: ["agent-knowledge", agent.id] }); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TrainingStudio({ agent }: { agent: Agent }) {
  const chatFn = useServerFn(chatWithAgent);
  const saveFn = useServerFn(saveTrainingSession);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const startedAt = useRef<number>(Date.now());
  const recogRef = useRef<any>(null);

  const speak = (text: string) => {
    if (!autoSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = agent.language || "en-US";
      const voices = window.speechSynthesis.getVoices();
      const wantsFemale = agent.voice_id.includes("female");
      const wantsMale = agent.voice_id.includes("male");
      const uk = agent.voice_id.includes("uk");
      const au = agent.voice_id.includes("au");
      const match = voices.find(v =>
        (uk ? v.lang.startsWith("en-GB") : au ? v.lang.startsWith("en-AU") : v.lang.startsWith("en"))
        && (wantsFemale ? /female|samantha|victoria|karen|zira|ava|allison/i.test(v.name) : wantsMale ? /male|david|daniel|alex|fred/i.test(v.name) : true)
      ) ?? voices.find(v => v.lang.startsWith("en"));
      if (match) u.voice = match;
      u.rate = 1.0;
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const { reply } = await chatFn({ data: { agent_id: agent.id, messages: next } });
      setMessages([...next, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
    finally { setThinking(false); }
  };

  const toggleMic = () => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input isn't supported in this browser. Try Chrome or Edge."); return; }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = agent.language || "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (ev: any) => {
      const text = Array.from(ev.results).map((res: any) => res[0].transcript).join(" ");
      setListening(false);
      send(text);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  };

  const saveSession = async () => {
    if (messages.length === 0) { toast.error("Nothing to save yet"); return; }
    try {
      await saveFn({ data: {
        agent_id: agent.id,
        title: `Training ${new Date().toLocaleString()}`,
        transcript: messages.map(m => ({ role: m.role, text: m.content })),
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      } });
      toast.success("Training session saved. The AI will use this for future calls.");
      setMessages([]); startedAt.current = Date.now();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">Training studio</div>
          <div className="text-xs text-muted-foreground">Talk to your AI caller like a prospect would. Press the mic, teach it, and save the session.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={autoSpeak ? "default" : "outline"} onClick={() => setAutoSpeak(v => !v)}>
            <Volume2 className="w-4 h-4 mr-1" /> {autoSpeak ? "Speaking on" : "Speaking off"}
          </Button>
          <Button size="sm" variant="outline" onClick={saveSession} disabled={messages.length === 0}>Save session</Button>
        </div>
      </div>
      <div className="h-[440px] overflow-auto p-4 space-y-3 bg-background/40">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            Press the microphone to speak, or type a message below.<br /> Try: "Hey, why are you calling me?"
          </p>
        ) : messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {m.content}
            </div>
          </div>
        ))}
        {thinking && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</div>}
      </div>
      <div className="p-3 border-t border-border flex items-center gap-2">
        <Button size="lg" variant={listening ? "destructive" : "default"} onClick={toggleMic} className="rounded-full w-12 h-12 p-0" aria-label="Toggle mic">
          {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…" onKeyDown={(e) => { if (e.key === "Enter") send(input); }} />
        <Button onClick={() => send(input)} disabled={!input.trim() || thinking}>Send</Button>
      </div>
    </Card>
  );
}

function ObjectionsTab({ agent }: { agent: Agent }) {
  const listFn = useServerFn(listObjections);
  const upsertFn = useServerFn(upsertObjection);
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["agent-objections", agent.id],
    queryFn: () => listFn({ data: { agent_id: agent.id } }),
  });
  const [obj, setObj] = useState("");
  const [reb, setReb] = useState("");
  const add = async () => {
    if (!obj.trim() || !reb.trim()) return;
    await upsertFn({ data: { agent_id: agent.id, objection: obj.trim(), rebuttal: reb.trim(), approved: true } });
    setObj(""); setReb("");
    qc.invalidateQueries({ queryKey: ["agent-objections", agent.id] });
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="font-semibold">Add a rebuttal</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Objection</Label><Input value={obj} onChange={(e) => setObj(e.target.value)} placeholder={`e.g. "I'm not interested"`} /></div>
          <div><Label>Rebuttal</Label><Input value={reb} onChange={(e) => setReb(e.target.value)} placeholder="Short one-line response…" /></div>
        </div>
        <div><Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Add</Button></div>
      </Card>
      <Card className="p-4">
        <div className="font-semibold mb-3">Learned & saved objections ({items.length})</div>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet. Objections are learned automatically from every completed call.</p> : (
          <div className="space-y-2">
            {items.map((o: any) => (
              <div key={o.id} className="border border-border rounded-md p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">"{o.objection}"</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{o.times_encountered}× seen</Badge>
                    {o.auto_learned && !o.approved && <Badge>Needs review</Badge>}
                    {o.approved && <Badge variant="outline">Approved</Badge>}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">→ {o.rebuttal || <em>(no rebuttal yet)</em>}</div>
                {!o.approved && (
                  <div className="pt-1">
                    <Button size="sm" variant="outline" onClick={async () => {
                      await upsertFn({ data: { id: o.id, agent_id: agent.id, objection: o.objection, rebuttal: o.rebuttal, approved: true } });
                      qc.invalidateQueries({ queryKey: ["agent-objections", agent.id] });
                    }}>Approve</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CallsTab({ agent }: { agent: Agent }) {
  const listFn = useServerFn(listCallRuns);
  const learnFn = useServerFn(learnFromCall);
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["call-runs", agent.id],
    queryFn: () => listFn({ data: { agent_id: agent.id, limit: 100 } }),
  });
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="font-semibold">Call history</div>
        <div className="text-xs text-muted-foreground">Every call made by this AI caller. Start calls from the Pipeline or a contact.</div>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No calls yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r: any) => (
            <div key={r.id} className="p-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.phone_number || "Unknown number"}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {Math.round(r.duration_seconds || 0)}s</div>
                {r.summary && <div className="text-xs mt-1 line-clamp-2">{r.summary}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge>
                {r.outcome && <Badge variant="outline">{r.outcome}</Badge>}
                {r.status === "completed" && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const res = await learnFn({ data: { call_run_id: r.id } });
                    toast.success(`Learned ${res.learned} new objection(s)`);
                    qc.invalidateQueries({ queryKey: ["agent-objections", agent.id] });
                  }}>Learn</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatsTab({ agent }: { agent: Agent }) {
  const statsFn = useServerFn(getCallStats);
  const { data: s } = useQuery({
    queryKey: ["call-stats", agent.id],
    queryFn: () => statsFn({ data: { agent_id: agent.id } }),
  });
  const stats = s ?? { total_calls: 0, connected: 0, completed: 0, converted: 0, connect_rate: 0, conversion_rate: 0, avg_duration: 0 };
  const cards = [
    { label: "Total calls", value: stats.total_calls },
    { label: "Connected", value: stats.connected },
    { label: "Completed", value: stats.completed },
    { label: "Interested / converted", value: stats.converted },
    { label: "Connect rate", value: `${stats.connect_rate}%` },
    { label: "Conversion rate", value: `${stats.conversion_rate}%` },
    { label: "Avg duration", value: `${stats.avg_duration}s` },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="p-4">
          <div className="text-xs text-muted-foreground">{c.label}</div>
          <div className="text-2xl font-semibold mt-1">{c.value}</div>
        </Card>
      ))}
    </div>
  );
}
