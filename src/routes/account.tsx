import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, LogOut, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [sub, setSub] = useState<any>(null);
  const [signup, setSignup] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { setLoading(false); return; }
      setAuthed(true);
      const uid = sess.session.user.id;
      const [s, sg] = await Promise.all([
        supabase.from("subscriptions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("signups").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setSub(s.data); setSignup(sg.data); setLoading(false);
    })();
  }, []);

  if (!loading && !authed) return <Navigate to="/login" />;

  const plan = sub?.plan_slug ?? signup?.selected_plan_slug ?? "—";
  const status = sub?.status ?? signup?.status ?? "pending";
  const statusColor = status === "active" || status === "provisioned" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : status === "paid" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";

  return (
    <div className="r4d-obsidian min-h-screen" style={{ fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif' }}>
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-black text-white">Reach for Dollars</Link>
          <button onClick={() => supabase.auth.signOut().then(() => location.href = "/")} className="text-sm text-zinc-400 hover:text-white inline-flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-black text-4xl text-white tracking-tight">Your account</h1>
        <div className="mt-8 r4d-surface border border-white/5 rounded-2xl p-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-500">Current plan</div>
              <div className="font-black text-2xl text-white mt-1 capitalize">{plan}</div>
              <div className="text-sm text-zinc-400 mt-1">{sub?.seats ?? 1} seat{(sub?.seats ?? 1) > 1 ? "s" : ""} · Next billing: {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}</div>
            </div>
            <span className={`text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded-full border ${statusColor}`}>{status}</span>
          </div>
          {(status === "active" || status === "provisioned") ? (
            <Link to="/dashboard" className="mt-8 inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3.5 rounded-xl transition r4d-glow-emerald">
              Open Reach for Dollars <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="mt-8 bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-sm text-amber-200">
              Your account is being set up — you'll get access shortly. Email <a className="underline" href="mailto:support@dialingfordollars.co">support</a> if it takes more than a few minutes.
            </div>
          )}
        </div>
        <div className="mt-6 text-sm text-zinc-500">
          Manage billing? <a href="https://whop.com/orders" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-1">Visit Whop <ExternalLink className="w-3 h-3" /></a>
        </div>
      </main>
    </div>
  );
}
