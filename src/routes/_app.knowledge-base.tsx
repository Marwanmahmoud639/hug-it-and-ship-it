import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Trash2, Copy, Mail, MessageSquare, PhoneCall, Send, Brain } from "lucide-react";
import { listTemplates, saveTemplate, deleteTemplate, duplicateTemplate } from "@/lib/templates.functions";
import { DISCOVERY_INDUSTRIES } from "@/lib/discovery-industries";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/knowledge-base")({ component: KnowledgeBase });

type Kind = "email" | "sms" | "call_script" | "dm";
type Platform = "facebook" | "instagram" | "linkedin";

const KIND_META: Record<Kind, { label: string; icon: typeof Mail; blurb: string }> = {
  email: { label: "Email", icon: Mail, blurb: "Plain-text and HTML bodies. Plain text is what sends when a recipient blocks rich mail." },
  sms: { label: "SMS", icon: MessageSquare, blurb: "Keep under 160 characters per segment — longer messages bill as multiple sends." },
  call_script: { label: "Call Scripts", icon: PhoneCall, blurb: "Openers, discovery questions, and objection handling for live and AI calls." },
  dm: { label: "Social DMs", icon: Send, blurb: "Direct messages for Facebook, Instagram, and LinkedIn." },
};

function KnowledgeBase() {
  return (
    <div className="h-full overflow-auto">
      <PageHeader
        title="Knowledge Base"
        subtitle="Every piece of outreach copy in one place — reusable across campaigns, and scored by what actually gets replies."
      />
      <div className="p-4 md:p-6">
        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="call_script">Call Scripts</TabsTrigger>
            <TabsTrigger value="dm">Social DMs</TabsTrigger>
            <TabsTrigger value="ai">AI Caller Brain</TabsTrigger>
          </TabsList>

          {(Object.keys(KIND_META) as Kind[]).map((kind) => (
            <TabsContent key={kind} value={kind} className="mt-4">
              <TemplateList kind={kind} />
            </TabsContent>
          ))}

          <TabsContent value="ai" className="mt-4">
            <AiBrainPlaceholder />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TemplateList({ kind }: { kind: Kind }) {
  const list = useServerFn(listTemplates);
  const del = useServerFn(deleteTemplate);
  const dup = useServerFn(duplicateTemplate);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["templates", kind],
    queryFn: () => list({ data: { kind, includeInactive: true } }),
  });
  const templates = data?.templates ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["templates", kind] });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });
  const dupMut = useMutation({
    mutationFn: (id: string) => dup({ data: { id } }),
    onSuccess: () => { toast.success("Duplicated (saved as inactive)"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Duplicate failed"),
  });

  const meta = KIND_META[kind];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">{meta.blurb}</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New {meta.label}
        </Button>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!isLoading && templates.length === 0 && (
        <EmptyState
          icon={meta.icon}
          title={`No ${meta.label.toLowerCase()} templates yet`}
          body="Save your best-performing copy here so it can be reused and ranked."
        />
      )}

      <div className="grid gap-3">
        {templates.map((t: any) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{t.name}</span>
                  {!t.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  {t.platform && <Badge variant="outline" className="text-[10px] capitalize">{t.platform}</Badge>}
                  {t.industry && <Badge variant="outline" className="text-[10px]">{t.industry}</Badge>}
                </div>
                {t.subject && <div className="text-xs text-muted-foreground mt-1">Subject: {t.subject}</div>}
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{t.body_text}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span>Used {t.times_used}</span>
                  <span>·</span>
                  <span>
                    {t.times_used > 0
                      ? `${Math.round((t.times_responded / t.times_used) * 100)}% replied`
                      : "No sends yet"}
                  </span>
                  {t.variables?.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{t.variables.map((v: string) => `{${v}}`).join(" ")}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => dupMut.mutate(t.id)} title="Duplicate">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { if (confirm(`Delete "${t.name}"? This can't be undone.`)) delMut.mutate(t.id); }}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <TemplateDialog
        kind={kind}
        open={open}
        onOpenChange={setOpen}
        existing={editing}
        onSaved={invalidate}
      />
    </div>
  );
}

function TemplateDialog({
  kind, open, onOpenChange, existing, onSaved,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: any | null;
  onSaved: () => void;
}) {
  const save = useServerFn(saveTemplate);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Re-seed the form whenever the dialog opens for a different template.
  const seedKey = `${existing?.id ?? "new"}-${open}`;
  const [seeded, setSeeded] = useState("");
  if (open && seeded !== seedKey) {
    setSeeded(seedKey);
    setName(existing?.name ?? "");
    setIndustry(existing?.industry ?? "");
    setPlatform((existing?.platform as Platform) ?? "linkedin");
    setSubject(existing?.subject ?? "");
    setBodyText(existing?.body_text ?? "");
    setBodyHtml(existing?.body_html ?? "");
    setIsActive(existing?.is_active ?? true);
  }

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: existing?.id,
          kind,
          platform: kind === "dm" ? platform : null,
          name,
          industry: industry || null,
          subject: kind === "email" ? subject || null : null,
          body_text: bodyText,
          body_html: kind === "email" ? bodyHtml || null : null,
          tags: [],
          is_active: isActive,
        } as never,
      }),
    onSuccess: () => {
      toast.success(existing ? "Template updated" : "Template created");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const smsSegments = Math.ceil(bodyText.length / 160) || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit" : "New"} {KIND_META[kind].label} template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cold opener — roofing" maxLength={200} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Industry <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={industry || "__none"} onValueChange={(v) => setIndustry(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Any industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Any industry</SelectItem>
                  {DISCOVERY_INDUSTRIES.map((i) => (
                    <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {kind === "dm" && (
              <div className="grid gap-1.5">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {kind === "email" && (
            <div className="grid gap-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about {company}" maxLength={300} />
            </div>
          )}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>{kind === "email" ? "Plain-text body" : "Message"}</Label>
              {kind === "sms" && (
                <span className={`text-xs ${bodyText.length > 160 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {bodyText.length} chars · {smsSegments} segment{smsSegments > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <Textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={kind === "call_script" ? 12 : 7}
              placeholder={
                kind === "call_script"
                  ? "Opener…\n\nDiscovery questions…\n\nObjection: “We already have someone.”\nResponse: …"
                  : "Hi {first_name}, …"
              }
              maxLength={20000}
            />
            <p className="text-xs text-muted-foreground">
              Use <code>{"{first_name}"}</code>, <code>{"{company}"}</code>, <code>{"{city}"}</code> — merge fields are detected automatically on save.
            </p>
          </div>

          {kind === "email" && (
            <div className="grid gap-1.5">
              <Label>HTML body <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={7}
                placeholder="<p>Hi {first_name},</p>"
                className="font-mono text-xs"
                maxLength={100000}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to send plain text only. Plain text is the fallback whenever HTML is blocked.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="tpl-active" />
            <Label htmlFor="tpl-active" className="font-normal">Active — available to campaigns</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || name.trim().length === 0 || bodyText.trim().length === 0}>
            {mut.isPending ? "Saving…" : existing ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiBrainPlaceholder() {
  return (
    <EmptyState
      icon={Brain}
      title="AI Caller Brain"
      body="Reference material the AI caller draws on mid-call — pricing, service areas, qualifying criteria, objection handling. Wired to the existing agent_knowledge store; the editor lands with the AI calling work."
    />
  );
}
