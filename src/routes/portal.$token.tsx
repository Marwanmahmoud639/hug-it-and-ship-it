import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/portal/$token")({
  component: PortalView,
  head: () => ({ meta: [{ title: "Client Portal" }] }),
});

function PortalView() {
  const { token } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/portal-view", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async r => {
      if (!r.ok) { setErr((await r.json()).error || "Not found"); return; }
      setData(await r.json());
    }).catch(e => setErr(e?.message || "Error"));
  }, [token]);

  if (err) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{err}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  const color = data.agency?.color || "#2563EB";
  const contacts: any[] = data.contacts ?? [];
  const activity: any[] = data.activity ?? [];
  const stats = data.stats ?? {};

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b" style={{ borderColor: color + "20" }}>
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.agency?.logo && <img src={data.agency.logo} alt={data.agency.name} className="h-10" />}
            <div className="font-bold text-lg" style={{ color }}>{data.agency?.name}</div>
          </div>
          <div className="text-sm text-muted-foreground">{data.portal?.name}</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="New leads (7d)" value={stats.leads_week ?? 0} />
          <Stat label="Calls (7d)" value={stats.calls_week ?? 0} />
          <Stat label="Responses (7d)" value={stats.responses_week ?? 0} />
          <Stat label="Stage moves (7d)" value={stats.stage_changes_week ?? 0} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Leads</h2>
          <div className="border rounded-md divide-y">
            {contacts.length === 0 && <div className="p-4 text-sm text-muted-foreground">No leads in this window yet.</div>}
            {contacts.map(c => (
              <div key={c.id} className="p-3 flex justify-between items-center">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name || "(no name)"}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.title}{c.title && c.company ? " · " : ""}{c.company}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{c.email_masked} · {c.phone_masked}</div>
                </div>
                <span className="text-xs font-mono shrink-0 ml-3">{c.lead_score ?? 0}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          <div className="border rounded-md divide-y">
            {activity.length === 0 && <div className="p-4 text-sm text-muted-foreground">No activity yet.</div>}
            {activity.map(a => (
              <div key={a.id} className="p-3 text-sm flex justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium capitalize">{a.action.replace(/_/g, " ")}</span>
                  {a.channel && <span className="text-xs text-muted-foreground ml-2">via {a.channel}</span>}
                  {a.note && <div className="text-xs text-muted-foreground truncate">{a.note}</div>}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="text-center text-xs text-muted-foreground border-t pt-4">
          Read-only view · Powered by {data.agency?.name}
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-md p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
