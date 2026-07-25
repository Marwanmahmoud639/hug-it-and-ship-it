import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, ArrowRight, Shield } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Reach for Dollars" },
      { name: "description", content: "Three engines. One mission: surround every decision maker until they answer. Secure Whop checkout, cancel anytime." },
    ],
  }),
  component: PricingPage,
});

type Plan = {
  slug: string;
  name: string;
  price_monthly: number;
  seats: number;
  features: string[];
  sort_order: number;
  whop_checkout_url: string | null;
  trial_days: number | null;
};

function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    supabase
      .from("plans")
      .select("slug, name, price_monthly, seats, features, sort_order, whop_checkout_url, trial_days")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setPlans((data as any) ?? []));
  }, []);

  return (
    <div className="r4d-obsidian min-h-screen" style={{ fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif' }}>
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black text-white">Reach for Dollars</Link>
          <Link to="/login" className="text-sm text-zinc-400 hover:text-white">Sign in</Link>
        </div>
      </header>
      <main className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs uppercase tracking-widest r4d-lime mb-3">Pricing</div>
            <h1 className="font-black text-4xl sm:text-5xl text-white tracking-tight">Pick your engine.</h1>
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto">
              Every plan runs the same 5-channel surround sequence. Bigger plans = more decision makers reached per month.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p, i) => {
              const featured = p.slug === "professional" || (plans.length === 3 && i === 1);
              const isEnterprise = p.slug === "enterprise" || !p.whop_checkout_url;
              const href = isEnterprise ? "/enterprise" : (p.whop_checkout_url ?? "#");
              return (
                <div
                  key={p.slug}
                  className={`relative rounded-3xl p-8 transition ${
                    featured
                      ? "bg-gradient-to-b from-[#C6F432]/15 via-[#C6F432]/5 to-transparent border-2 border-[#C6F432]/40 r4d-glow-lime scale-[1.02]"
                      : "r4d-surface border border-white/5 hover:border-[#C6F432]/30"
                  }`}
                >
                  {featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 r4d-bg-lime text-black text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </div>
                  )}
                  <h3 className="font-bold text-xl text-white">{p.name}</h3>
                  <p className="text-sm text-zinc-400 mt-1">{p.seats} seat{p.seats > 1 ? "s" : ""}</p>
                  {p.trial_days && p.trial_days > 0 && !isEnterprise && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {p.trial_days}-day free trial
                    </div>
                  )}
                  <div className="mt-6 flex items-baseline gap-1">
                    {isEnterprise ? (
                      <>
                        <span className="text-4xl font-black text-white">Custom</span>
                        <span className="text-zinc-500 ml-1">pricing</span>
                      </>
                    ) : (
                      <>
                        <span className="text-5xl font-black text-white">${Number(p.price_monthly)}</span>
                        <span className="text-zinc-500">/mo</span>
                      </>
                    )}
                  </div>
                  {isEnterprise ? (
                    <Link
                      to="/enterprise"
                      className="mt-6 flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition bg-white text-black hover:bg-white/90"
                    >
                      Book a call <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-6 flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition ${
                        featured
                          ? "r4d-bg-lime hover:opacity-90 text-black"
                          : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                      }`}
                    >
                      Checkout {p.name} <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                  <ul className="mt-8 space-y-3">
                    {(p.features ?? []).map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-zinc-300">
                        <Check className="w-4 h-4 r4d-lime mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-10 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Secure checkout via Whop · After payment you'll be sent to{" "}
            <Link to="/signup" className="underline hover:text-zinc-300">/signup</Link> to claim access
          </p>
        </div>
      </main>
    </div>
  );
}
