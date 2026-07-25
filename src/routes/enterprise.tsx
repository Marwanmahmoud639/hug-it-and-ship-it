import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/enterprise")({
  head: () => ({
    meta: [
      { title: "Enterprise Engine — Book a call · Reach for Dollars" },
      {
        name: "description",
        content:
          "Enterprise Engine starts at 50,000+ credits/month with custom pricing tailored to your outbound volume. Book a call to design your plan.",
      },
      { property: "og:title", content: "Enterprise Engine — Book a call · Reach for Dollars" },
      { property: "og:description", content: "Custom credits, dedicated success, white-label, SSO, priority skip-trace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnterprisePage,
});

const FEATURES = [
  "50,000+ credits / month (custom)",
  "Custom pricing tailored to your volume",
  "Unlimited sub-accounts + white-label",
  "Dedicated success manager",
  "Priority skip-trace waterfall + higher rate limits",
  "SSO + custom SLA",
  "Custom integrations & API access",
  "Onboarding & migration support",
];

function EnterprisePage() {
  useEffect(() => {
    // Guard against double-injecting when navigating back to this route.
    if ((window as any).__r4dCalLoaded) {
      try {
        (window as any).Cal?.ns?.reach4dollars?.("inline", {
          elementOrSelector: "#my-cal-inline-reach4dollars",
          config: { layout: "month_view", useSlotsViewOnSmallScreen: "true" },
          calLink: "dialingfordollars/reach4dollars",
        });
      } catch {}
      return;
    }
    (window as any).__r4dCalLoaded = true;

    // Vendor snippet — kept faithful to the provided embed code.
    (function (C: any, A: string, L: string) {
      const p = function (a: any, ar: any) { a.q.push(ar); };
      const d = C.document;
      C.Cal =
        C.Cal ||
        function () {
          const cal = C.Cal;
          const ar = arguments as any;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement("script")).src = A;
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api: any = function () { p(api, arguments); };
            const namespace = ar[1];
            api.q = api.q || [];
            if (typeof namespace === "string") {
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace], ar);
              p(cal, ["initNamespace", namespace]);
            } else {
              p(cal, ar);
            }
            return;
          }
          p(cal, ar);
        };
    })(window, "https://app.cal.com/embed/embed.js", "init");

    (window as any).Cal("init", "reach4dollars", { origin: "https://app.cal.com" });
    (window as any).Cal.config = (window as any).Cal.config || {};
    (window as any).Cal.config.forwardQueryParams = true;
    (window as any).Cal.ns.reach4dollars("inline", {
      elementOrSelector: "#my-cal-inline-reach4dollars",
      config: { layout: "month_view", useSlotsViewOnSmallScreen: "true" },
      calLink: "dialingfordollars/reach4dollars",
    });
    (window as any).Cal.ns.reach4dollars("ui", {
      hideEventTypeDetails: false,
      layout: "month_view",
    });
  }, []);

  return (
    <div className="r4d-obsidian min-h-screen" style={{ fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif' }}>
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black text-white">Reach for Dollars</Link>
          <Link to="/pricing" className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to pricing
          </Link>
        </div>
      </header>
      <main className="px-6 py-16">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-10">
          <div>
            <div className="text-xs uppercase tracking-widest r4d-lime mb-3">Enterprise Engine</div>
            <h1 className="font-black text-4xl sm:text-5xl text-white tracking-tight">Built for volume. Priced for you.</h1>
            <p className="text-zinc-400 mt-4">
              50,000+ credits every month, dedicated success, white-label, and priority infrastructure. Book a 20-min call —
              we'll tailor credits, seats, and integrations to your team.
            </p>
            <ul className="mt-8 space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-zinc-200">
                  <Check className="w-4 h-4 r4d-lime mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="r4d-surface border border-white/5 rounded-3xl p-4 min-h-[720px]">
            <div
              style={{ width: "100%", height: "100%", minHeight: 700, overflow: "scroll" }}
              id="my-cal-inline-reach4dollars"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
