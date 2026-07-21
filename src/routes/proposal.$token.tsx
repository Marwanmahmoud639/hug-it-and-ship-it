import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/proposal/$token")({
  component: ProposalView,
  head: () => ({ meta: [{ title: "Proposal" }] }),
});

type ProposalData = {
  proposal: any;
  agency: { name: string; color: string | null; logo: string | null };
};

function ProposalView() {
  const { token } = Route.useParams();
  const [data, setData] = useState<ProposalData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/proposal-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async r => {
        if (!r.ok) { setErr((await r.json()).error || "Not found"); return; }
        setData(await r.json());
      })
      .catch(e => setErr(e?.message || "Error"));
  }, [token]);

  if (err) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{err}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading proposal…</div>;

  const { proposal: p, agency } = data;
  const color = agency.color || "#2563EB";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b" style={{ borderColor: color + "20" }}>
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-3">
          {agency.logo && <img src={agency.logo} alt={agency.name} className="h-10" />}
          <div className="font-bold text-lg" style={{ color }}>{agency.name}</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        <section>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Proposal for</p>
          <h1 className="text-4xl font-bold tracking-tight mt-1" style={{ color }}>{p.business_name}</h1>
          <p className="text-lg text-muted-foreground mt-2">Prepared for {p.prospect_name}</p>
        </section>

        {(p.industry || p.location || p.monthly_lead_goal) && (
          <section className="grid sm:grid-cols-3 gap-4">
            {p.industry && <Stat label="Industry" value={p.industry} />}
            {p.location && <Stat label="Location" value={p.location} />}
            {p.monthly_lead_goal && <Stat label="Monthly lead goal" value={String(p.monthly_lead_goal)} />}
          </section>
        )}

        {p.notes && (
          <section>
            <h2 className="text-xl font-semibold mb-2">The Opportunity</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{p.notes}</p>
          </section>
        )}

        <section className="border rounded-xl p-8" style={{ borderColor: color + "40", background: color + "08" }}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommended package</p>
          <h2 className="text-3xl font-bold mt-2 capitalize">{p.package_selected}</h2>
          {p.package_price > 0 && (
            <div className="mt-2 text-2xl font-bold" style={{ color }}>${p.package_price.toLocaleString()}<span className="text-sm text-muted-foreground font-normal">/mo</span></div>
          )}
        </section>

        {p.sample_leads?.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-3">Sample Leads</h2>
            <div className="grid gap-2">
              {p.sample_leads.map((l: any, i: number) => (
                <div key={i} className="border rounded-md p-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{l.name || l.company}</div>
                    <div className="text-xs text-muted-foreground">{l.title}{l.title && l.company ? " · " : ""}{l.company}</div>
                  </div>
                  {l.lead_score && <span className="text-xs font-mono">{l.lead_score}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {p.guarantee_text && (
          <section className="border-l-4 pl-4" style={{ borderColor: color }}>
            <h2 className="text-xl font-semibold mb-1">Our Guarantee</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{p.guarantee_text}</p>
          </section>
        )}

        {p.testimonial && (
          <section>
            <blockquote className="text-lg italic text-muted-foreground border-l-4 pl-4" style={{ borderColor: color }}>
              "{p.testimonial}"
            </blockquote>
          </section>
        )}

        {p.cta_url && (
          <section className="text-center">
            <a href={p.cta_url} target="_blank" rel="noreferrer"
              className="inline-block px-8 py-3 rounded-md text-white font-semibold"
              style={{ background: color }}>
              Book a call to get started
            </a>
          </section>
        )}

        <footer className="text-center text-xs text-muted-foreground border-t pt-6">
          {p.expires_at && <>This proposal expires on {new Date(p.expires_at).toLocaleDateString()}. </>}
          Prepared by {agency.name}
        </footer>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold mt-1">{value}</div>
    </div>
  );
}
