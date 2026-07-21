import { useRef } from "react";
import type { Node } from "@xyflow/react";
import { getBlockDef, MERGE_TAGS } from "./block-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  selected: Node | null;
  onChange: (config: Record<string, any>) => void;
  onDelete: (id: string) => void;
};

export function BlockConfigPanel({ selected, onChange, onDelete }: Props) {
  if (!selected) {
    return (
      <div className="h-full border-l bg-muted/30 p-6 text-sm text-muted-foreground">
        Select a block on the canvas to configure it. Drag blocks from the left to build your workflow.
      </div>
    );
  }
  const data = selected.data as { blockId: string; config: Record<string, any> };
  const def = getBlockDef(data.blockId);
  if (!def) return <div className="p-4 text-sm text-destructive">Unknown block type</div>;
  const Icon = def.icon;

  return (
    <div className="h-full border-l bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4" />
          <h3 className="font-semibold text-sm">{def.label}</h3>
          <Badge variant="outline" className="ml-auto text-[10px] capitalize">{def.category}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{def.description}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {def.fields.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No configuration needed.</p>
        )}
        {def.fields.map(f => (
          <FieldRow key={f.key} field={f} value={data.config?.[f.key]} onChange={(v) => onChange({ ...data.config, [f.key]: v })} />
        ))}
      </div>
      <div className="p-4 border-t">
        <Button variant="destructive" size="sm" className="w-full" onClick={() => onDelete(selected.id)}>
          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete block
        </Button>
      </div>
    </div>
  );
}

function FieldRow({ field, value, onChange }: { field: any; value: any; onChange: (v: any) => void }) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const insertMergeTag = (tag: string) => {
    const el = ref.current as any;
    if (!el) { onChange((value ?? "") + tag); return; }
    const start = el.selectionStart ?? (value ?? "").length;
    const end = el.selectionEnd ?? start;
    const next = (value ?? "").slice(0, start) + tag + (value ?? "").slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}</Label>
        {field.mergeTags && (
          <Select onValueChange={insertMergeTag}>
            <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue placeholder="Merge tag" /></SelectTrigger>
            <SelectContent>{MERGE_TAGS.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      {field.type === "text" && (
        <Input ref={ref as any} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className="h-8 text-sm" />
      )}
      {field.type === "number" && (
        <Input type="number" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} placeholder={field.placeholder} className="h-8 text-sm" />
      )}
      {field.type === "textarea" && (
        <Textarea ref={ref as any} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} rows={5} className="text-sm" />
      )}
      {field.type === "select" && (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose…" /></SelectTrigger>
          <SelectContent>
            {field.options.map((o: any) => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {field.type === "boolean" && (
        <div className="flex items-center gap-2"><Switch checked={!!value} onCheckedChange={onChange} /><span className="text-xs text-muted-foreground">{value ? "True" : "False"}</span></div>
      )}
    </div>
  );
}
