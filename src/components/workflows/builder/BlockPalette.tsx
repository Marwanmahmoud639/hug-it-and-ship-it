import { useState } from "react";
import { blocksByCategory, type BlockCategory } from "./block-types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const CATEGORIES: { id: BlockCategory; label: string }[] = [
  { id: "trigger", label: "Triggers" },
  { id: "action", label: "Actions" },
  { id: "condition", label: "Conditions" },
  { id: "delay", label: "Delays" },
];

export function BlockPalette() {
  const [query, setQuery] = useState("");
  const q = query.toLowerCase();

  return (
    <div className="h-full flex flex-col border-r bg-muted/30">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search blocks" className="pl-8 h-8" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Accordion type="multiple" defaultValue={CATEGORIES.map(c => c.id)} className="p-2">
          {CATEGORIES.map(cat => {
            const blocks = blocksByCategory(cat.id).filter(
              b => !q || b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q),
            );
            if (q && blocks.length === 0) return null;
            return (
              <AccordionItem key={cat.id} value={cat.id} className="border-b-0">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wider py-2">
                  {cat.label}
                </AccordionTrigger>
                <AccordionContent className="space-y-1">
                  {blocks.map(b => {
                    const Icon = b.icon;
                    return (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/lovable-block", b.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className={`group flex items-start gap-2 p-2 rounded-md border border-transparent hover:border-border hover:bg-background cursor-grab active:cursor-grabbing transition`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{b.label}</div>
                          <div className="text-[10px] text-muted-foreground line-clamp-2">{b.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
