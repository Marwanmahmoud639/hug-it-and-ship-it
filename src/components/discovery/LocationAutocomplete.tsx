import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

interface NominatimResult {
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

function formatResult(r: NominatimResult): string {
  const a = r.address || {};
  const city = a.city || a.town || a.village || a.county;
  const cc = a.country_code?.toUpperCase();
  const parts = [city, a.state, cc].filter(Boolean);
  return parts.length ? parts.join(", ") : r.display_name.split(",").slice(0, 3).join(",").trim();
}

export function LocationAutocomplete({ id, value, onChange, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        // Restrict suggestions to USA + Canada only (matches discovery pipeline scope).
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us,ca&q=${encodeURIComponent(q)}&limit=6`,
          { headers: { "Accept-Language": "en-US,en" } }
        );
        if (!res.ok) return;
        const data: NominatimResult[] = await res.json();
        const seen = new Set<string>();
        const out: string[] = [];
        for (const r of data) {
          const cc = r.address?.country_code?.toLowerCase();
          if (cc && cc !== "us" && cc !== "ca") continue;
          const label = formatResult(r);
          if (!seen.has(label)) { seen.add(label); out.push(label); }
        }
        setSuggestions(out);
        setOpen(out.length > 0);
      } catch { /* network unavailable – silent */ }
    }, 350);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
      <Input
        id={id}
        value={value}
        onChange={(e) => { onChange(e.target.value); search(e.target.value); }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || "City, State (USA or Canada only)"}
        className="h-12 pl-9 text-sm"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 border-b border-border/40 last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setSuggestions([]);
                setOpen(false);
              }}
            >
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <span>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
