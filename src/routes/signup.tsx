import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { lookupPaidSignup } from "@/lib/access.functions";
import { toast } from "sonner";
import { ArrowRight, Loader2, Mail, CheckCircle2, Clock } from "lucide-react";

const searchSchema = z.object({
  paid: z.union([z.literal("1"), z.literal(1)]).optional(),
  plan: z.string().optional(),
  email: z.string().email().optional(),
});

export const Route = createFileRoute("/signup")({
  validateSearch: searchSchema,
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();
  const search = useSearch({ from: "/signup" });
  const lookup = useServerFn(lookupPaidSignup);
  const [email, setEmail] = useState(search.email ?? "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().email().safeParse(email.trim().toLowerCase());
    if (!parsed.success) {
      toast.error("Please enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      const res = await lookup({ data: { email: parsed.data } });
      if (!res.found) {
        // Webhook may not have fired yet — still let them through to /signup/pending.
        // Admin will see the row once Whop POSTs.
        nav({ to: "/signup/pending", search: { email: parsed.data, status: "awaiting_webhook" } });
        return;
      }
      if (res.status === "activated" || res.activated) {
        toast.info("You're already activated — sign in to continue.");
        nav({ to: "/login" });
        return;
      }
      if (res.status === "approved_awaiting_activation") {
        nav({ to: "/activate", search: { email: parsed.data } });
        return;
      }
      nav({ to: "/signup/pending", search: { email: parsed.data, status: res.status } });
    } catch (err: any) {
      toast.error(err?.message ?? "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="r4d-obsidian min-h-screen flex flex-col" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black text-white tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>
            REACH<span className="r4d-lime">.</span>
          </Link>
          <Link to="/login" className="text-sm text-zinc-400 hover:text-white">Already activated? Sign in</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {search.paid && (
            <div className="mb-6 r4d-glass-lime rounded-2xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-lime-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-white">Payment received</div>
                <div className="text-zinc-400 mt-0.5">Enter the email you used at checkout — we'll match it to your subscription.</div>
              </div>
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>
            Claim your seat
          </h1>
          <p className="text-zinc-400 mt-3 text-[15px]">
            We don't auto-create accounts. After your payment, an operator approves you and issues a one-time access code.
            Enter the email you paid with — we'll route you to the right step.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Email used at checkout</label>
              <div className="relative mt-2">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-lime-400 focus:bg-white/[0.06] rounded-xl pl-10 pr-4 py-3.5 text-white placeholder:text-zinc-600 r4d-ring-focus transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full r4d-bg-lime hover:opacity-90 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 r4d-glow-lime-sm"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-zinc-500 flex gap-3">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Approvals are usually handled within 1 business hour. You'll receive your one-time access code by email, then
              create your password.
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Haven't paid yet? <Link to="/pricing" className="text-lime-400 hover:underline">Pick a plan →</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
