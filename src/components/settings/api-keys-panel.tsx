import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Key } from "lucide-react";

type KeyField = {
  field: string;
  label: string;
  placeholder: string;
  help: string;
};

const PAID_KEYS: KeyField[] = [
  { field: "apollo_key", label: "Apollo.io API Key", placeholder: "Apollo API key", help: "Used as a paid fallback for person enrichment when free sources fail." },
  { field: "seamless_key", label: "Seamless.AI API Key", placeholder: "Seamless API key", help: "Optional paid fallback for B2B contacts." },
  { field: "clay_key", label: "Clay API Key", placeholder: "Clay API key", help: "Optional paid fallback for enrichment workflows." },
  { field: "lusha_api_key", label: "Lusha API Key", placeholder: "Lusha API key", help: "Optional paid fallback for direct dials and emails." },
  { field: "trestle_api_key", label: "Trestle API Key", placeholder: "Trestle API key", help: "Optional. Free reverse people-search (TruePeopleSearch / ThatsThem / CyberBackgroundChecks) runs first." },
  { field: "firecrawl_api_key", label: "Firecrawl API Key", placeholder: "Firecrawl API key", help: "Powers all free web scraping (company sites, social, reverse people-search)." },
  { field: "serper_api_key", label: "Serper API Key", placeholder: "Serper API key", help: "Google search for free decision-maker discovery (LinkedIn / Facebook / BBB)." },
  { field: "millionverifier_api_key", label: "MillionVerifier API Key", placeholder: "MillionVerifier API key", help: "Mailbox-level email verification (~$0.0004/check). Without it, guessed addresses ship unverified and may bounce." },
];

function KeyRow({ k, value, onSave }: { k: KeyField; value: string; onSave: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  const isSet = !!value;
  return (
    <div className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-primary" />
        <Label className="text-sm font-semibold">{k.label}</Label>
        {isSet ? (
          <Badge className="text-[10px] bg-[oklch(0.65_0.18_145)]/20 text-[oklch(0.65_0.18_145)]">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Saved
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">Not configured</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{k.help}</p>
      <Input
        type="password"
        placeholder={k.placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && onSave(v || null)}
        className="font-mono text-xs"
        maxLength={500}
        autoComplete="off"
      />
    </div>
  );
}

export function ApiKeysPanel({
  settings,
  save,
}: {
  settings: any;
  save: (patch: any) => void;
}) {
  return (
    <Card className="p-6 bg-card space-y-5">
      <div>
        <h3 className="font-semibold">Discovery & Enrichment API Keys</h3>
        <p className="text-xs text-muted-foreground mt-1">
          The discovery engine always tries free sources first (Google CSE, Firecrawl scraping, reverse
          people-search). Paid keys below are used only as fallbacks when free sources return nothing.
        </p>
      </div>
      {PAID_KEYS.map((k) => (
        <KeyRow key={k.field} k={k} value={settings?.[k.field] ?? ""} onSave={(v) => save({ [k.field]: v })} />
      ))}
      <p className="text-[11px] text-muted-foreground">
        Keys are stored in your team's protected settings row (RLS scoped to admins only). They override
        any matching environment variable.
      </p>
    </Card>
  );
}
