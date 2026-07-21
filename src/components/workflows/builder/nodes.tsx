// Custom node components for react-flow, one per category.
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getBlockDef } from "./block-types";
import { cn } from "@/lib/utils";

type Data = { blockId: string; config: Record<string, any>; invalid?: boolean };

function Base({ data, selected, showTarget = true, showSource = true, sourceHandles }: {
  data: Data; selected?: boolean; showTarget?: boolean; showSource?: boolean;
  sourceHandles?: { id: string; label: string; offset: string }[];
}) {
  const def = getBlockDef(data.blockId);
  if (!def) return <div className="px-3 py-2 border rounded bg-destructive/10 text-xs">Unknown block</div>;
  const Icon = def.icon;
  return (
    <div className={cn(
      "rounded-lg border-2 bg-card shadow-sm min-w-[220px] max-w-[260px] transition",
      def.color,
      selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      data.invalid && "border-destructive",
    )}>
      {showTarget && <Handle type="target" position={Position.Top} className="!w-3 !h-3" />}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-current/20">
        <Icon className="w-4 h-4 shrink-0" />
        <div className="text-xs font-semibold truncate">{def.label}</div>
      </div>
      <div className="px-3 py-2 text-[11px] text-foreground/70 break-words">
        {summarize(def, data.config) || <span className="italic opacity-60">Click to configure</span>}
      </div>
      {showSource && !sourceHandles && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3" />
      )}
      {sourceHandles && (
        <>
          {sourceHandles.map(h => (
            <div key={h.id} className="relative">
              <Handle
                id={h.id} type="source" position={Position.Bottom}
                style={{ left: h.offset }}
                className="!w-3 !h-3"
              />
              <div className="absolute text-[10px] font-semibold" style={{ left: `calc(${h.offset} - 12px)`, top: 4 }}>
                {h.label}
              </div>
            </div>
          ))}
          <div className="h-6" />
        </>
      )}
    </div>
  );
}

function summarize(def: ReturnType<typeof getBlockDef>, cfg: Record<string, any>): string {
  if (!def) return "";
  const parts: string[] = [];
  for (const f of def.fields) {
    const v = cfg?.[f.key];
    if (v === undefined || v === null || v === "") continue;
    const s = String(v);
    parts.push(`${f.label}: ${s.length > 30 ? s.slice(0, 30) + "…" : s}`);
  }
  return parts.join(" · ");
}

export function TriggerNode(props: NodeProps) {
  return <Base data={props.data as Data} selected={props.selected} showTarget={false} />;
}
export function ActionNode(props: NodeProps) {
  return <Base data={props.data as Data} selected={props.selected} />;
}
export function DelayNode(props: NodeProps) {
  return <Base data={props.data as Data} selected={props.selected} />;
}
export function ConditionNode(props: NodeProps) {
  return (
    <Base
      data={props.data as Data} selected={props.selected}
      sourceHandles={[
        { id: "true", label: "Yes", offset: "30%" },
        { id: "false", label: "No", offset: "70%" },
      ]}
    />
  );
}

export const NODE_TYPES = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
};
