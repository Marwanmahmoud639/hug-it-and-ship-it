import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { claimAccess } from "@/lib/access.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Loader2, KeyRound, Lock, Mail } from "lucide-react";

const searchSchema = z.object({
  email: z.string().email().optional(),
  code: z.string().optional(),
});

export const Route = createFileRoute("/activate")({
  validateSearch: searchSchema,
  component: ActivatePage,
});

function ActivatePage() {
  const nav = useNavigate();
  const search = useSearch({ from: "/activate" });
  const claim = useServerFn(claimAccess);
  const [email, setEmail] = useState(search.email ?? "");
  const [code, setCode] = useState(search.code ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords don't match.");
    if (!/^\d{6}$/.test(code.trim())) return toast.error("Access code must be 6 digits.");
    setBusy(true);
    try {
      await claim({ data: { email: email.trim().toLowerCase(), code: code.trim(), password } });
      // Sign them in
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        toast.success("Account created — please sign in.");
        nav({ to: "/login" });
        return;
      }
      toast.success("You're in.");
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err?.message ?? "Activation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="r4d-obsidian min-h-screen flex flex-col" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="font-black text-white" style={{ fontFamily: "Sora, sans-serif" }}>REACH<span className="r4d-lime">.</span></Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="w-12 h-12 rounded-xl r4d-glass-lime flex items-center justify-center mb-6">
            <KeyRound className="w-5 h-5 text-lime-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>
            Enter your access code
          </h1>
          <p className="text-zinc-400 mt-3 text-[15px]">
            One-time, 24-hour code. Use it to create your password and unlock your workspace.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field icon={<Mail className="w-4 h-4 text-zinc-500" />} label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com"
                className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder:text-zinc-600 r4d-ring-focus transition" />
            </Field>

            <Field icon={<KeyRound className="w-4 h-4 text-zinc-500" />} label="6-digit access code">
              <input type="text" required inputMode="numeric" pattern="\d{6}" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3.5 text-white font-mono tracking-[0.4em] text-center placeholder:text-zinc-700 r4d-ring-focus transition" />
            </Field>

            <Field icon={<Lock className="w-4 h-4 text-zinc-500" />} label="Create password">
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters"
                className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder:text-zinc-600 r4d-ring-focus transition" />
            </Field>

            <Field icon={<Lock className="w-4 h-4 text-zinc-500" />} label="Confirm password">
              <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password"
                className="w-full bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-lime-400 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder:text-zinc-600 r4d-ring-focus transition" />
            </Field>

            <button type="submit" disabled={busy}
              className="w-full r4d-bg-lime hover:opacity-90 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 r4d-glow-lime-sm mt-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Activate workspace <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Lost your code? <Link to="/signup" search={{}} className="text-lime-400 hover:underline">Start over →</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">{label}</label>
      <div className="relative mt-2">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2">{icon}</div>
        {children}
      </div>
    </div>
  );
}
