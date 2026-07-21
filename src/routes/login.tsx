import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BRAND } from "@/lib/brand";
import { BubbleBackgroundLazy } from "@/components/login/BubbleBackgroundLazy";
import { useTheme } from "@/lib/theme";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({ component: Login });

type Step = "email" | "waiting" | "code" | "password";

function Login() {
  const nav = useNavigate();
  const { resolved } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr || !password) { toast.error("Enter email and password"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
    setBusy(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login")) return toast.error("Invalid email or password");
      if (msg.includes("not confirmed")) return toast.error("Please verify your email first");
      return toast.error(error.message);
    }
    toast.success("Welcome back");
    nav({ to: "/dashboard" });
  };

  const forgotPassword = async () => {
    const addr = email.trim().toLowerCase();
    if (!addr || !addr.includes("@")) { toast.error("Enter your email first"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent — check your inbox.");
  };

  // Already signed in? jump to dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/dashboard" });
    });
  }, [nav]);

  // While waiting for admin approval, watch the request row via realtime.
  useEffect(() => {
    if (step !== "waiting" || !pendingId) return;
    const channel = supabase
      .channel(`login-req-${pendingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "login_requests", filter: `id=eq.${pendingId}` },
        async (payload) => {
          const row = payload.new as { status: string };
          if (row.status === "approved") {
            await sendOtp(email);
          } else if (row.status === "denied") {
            toast.error("Login request denied by administrator.");
            setStep("email");
            setPendingId(null);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [step, pendingId, email]);

  const OWNER_EMAIL = "marawanmahmoud4488@gmail.com";

  const sendOtp = async (addr: string) => {
    const isOwner = addr.toLowerCase() === OWNER_EMAIL;
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        shouldCreateUser: isOwner, // only the product owner can be created via OTP
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("signups not allowed") || m.includes("not allowed")) {
        toast.error("No account found for this email. If you've paid, finish setup at /signup.");
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.success("Code sent — check your inbox.");
    setStep("code");
  };

  const requestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr || !addr.includes("@")) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
      const { data, error } = await supabase.rpc("request_login", {
        _email: addr, _user_agent: ua,
      });
      if (error) throw error;
      const result = data as { status: string; message?: string; request_id?: string };
      if (result.status === "auto_approved") {
        await sendOtp(addr);
      } else if (result.status === "pending") {
        setPendingId(result.request_id ?? null);
        setStep("waiting");
        toast.message("Waiting for administrator approval…");
        // Fire-and-forget: ping super-admins via their notification channels.
        if (result.request_id) {
          fetch("/api/public/hooks/login-request-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: result.request_id }),
          }).catch(() => {});
        }
      } else if (result.status === "blocked") {
        toast.error(result.message || "This email is temporarily blocked.");
      } else if (result.status === "no_account") {
        toast.error(result.message || "No account found. Pay via /pricing, then finish setup at /signup.");
      } else if (result.status === "rate_limited") {
        toast.error(result.message || "Too many requests. Try again later.");
      } else {
        toast.error(result.message || "Could not start login.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Login failed");
    } finally { setBusy(false); }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) return toast.error("Invalid or expired code. Try requesting a new one.");
    toast.success("Welcome back");
    nav({ to: "/dashboard" });
  };

  const resend = async () => {
    setBusy(true);
    await sendOtp(email.trim().toLowerCase());
    setBusy(false);
  };

  const isLight = resolved === "light";
  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
      style={
        isLight
          ? {
              background:
                "radial-gradient(ellipse at top, oklch(0.985 0.022 85) 0%, oklch(0.96 0.03 80) 60%, oklch(0.93 0.035 75) 100%)",
            }
          : undefined
      }
    >
      {!isLight && <div className="absolute inset-0 bg-background" />}
      <BubbleBackgroundLazy />
      <div className="relative z-10 w-full max-w-sm">
        <PaintedWordmark isLight={isLight} />

        <Card
          className={`p-6 backdrop-blur-xl border-border ${
            isLight ? "bg-card/90 shadow-xl" : "bg-card/80"
          }`}
        >
          {step === "email" && (
            <>
              <h1 className="text-xl font-semibold mb-1">Sign in</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Continue with Google, or enter your email for a 6-digit code.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full mb-4 gap-2"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin + "/dashboard",
                  });
                  if (result.error) {
                    setBusy(false);
                    toast.error(result.error.message ?? "Google sign-in failed");
                    return;
                  }
                  if (result.redirected) return; // browser navigating to Google
                  nav({ to: "/dashboard" });
                }}
              >
                <GoogleIcon /> Continue with Google
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                  <span className="bg-card px-2 text-muted-foreground">or email</span>
                </div>
              </div>
              <form onSubmit={requestLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" required value={email}
                    onChange={e => setEmail(e.target.value)} autoFocus />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Login Code"}
                </Button>
              </form>
              <div className="mt-6 pt-4 border-t border-border text-center">
                <button type="button" onClick={() => setStep("password")}
                  className="text-xs text-muted-foreground hover:text-foreground">
                  Have a password? Sign in with email & password
                </button>
              </div>
            </>
          )}

          {step === "password" && (
            <>
              <h1 className="text-xl font-semibold mb-1">Sign in with password</h1>
              <p className="text-sm text-muted-foreground mb-6">
                For existing accounts with a password set.
              </p>
              <form onSubmit={signInWithPassword} className="space-y-4">
                <div>
                  <Label htmlFor="email-pw">Email address</Label>
                  <Input id="email-pw" type="email" required value={email}
                    onChange={e => setEmail(e.target.value)} autoFocus />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required value={password}
                    onChange={e => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                </Button>
                <div className="flex justify-between text-xs">
                  <button type="button" onClick={() => { setStep("email"); setPassword(""); }}
                    className="text-muted-foreground hover:text-foreground">Use email code instead</button>
                  <button type="button" onClick={forgotPassword}
                    className="text-primary hover:underline">Forgot password?</button>
                </div>
              </form>
            </>
          )}

          {step === "waiting" && (
            <div className="text-center py-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
              <h1 className="text-lg font-semibold mb-1">Waiting for approval</h1>
              <p className="text-sm text-muted-foreground">
                A super administrator needs to approve your first sign-in to{" "}
                <span className="font-medium text-foreground">{email}</span>.
                You'll get the code as soon as they approve.
              </p>
              <Button variant="ghost" size="sm" className="mt-4"
                onClick={() => { setStep("email"); setPendingId(null); }}>
                Use a different email
              </Button>
            </div>
          )}

          {step === "code" && (
            <>
              <h1 className="text-xl font-semibold mb-1">Check your email</h1>
              <p className="text-sm text-muted-foreground mb-6">
                We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
              </p>
              <form onSubmit={verifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Enter code</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
                    autoFocus
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={busy || code.length < 6}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Sign In"}
                </Button>
                <div className="flex justify-between text-xs">
                  <button type="button" onClick={() => setStep("email")}
                    className="text-muted-foreground hover:text-foreground">Use different email</button>
                  <button type="button" onClick={resend} disabled={busy}
                    className="text-primary hover:underline">Resend code</button>
                </div>
              </form>
            </>
          )}
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-6">
          {BRAND.loginRestrictedNote}
        </p>
      </div>
    </div>
  );
}

function PaintedWordmark({ isLight = false }: { isLight?: boolean }) {
  const brushPath =
    "M50 0 C 48 8, 55 14, 49 22 S 44 36, 52 46 C 58 54, 46 62, 51 72 S 47 86, 53 96 L 100 100 L 100 0 Z";
  const reachBase = isLight ? "#1B5E20" : "#4CAF50";
  const reachMask = isLight ? "#0a0a0a" : "#ffffff";
  const dollarsBase = isLight ? "#1B5E20" : "#2E7D32";
  const dollarsMask = isLight ? "#7CB342" : "#A5D6A7";
  const maskCss = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='${brushPath}' fill='black'/><rect x='0' y='0' width='50' height='100' fill='white'/></svg>")`;
  const maskStyle = {
    WebkitMaskImage: maskCss,
    maskImage: maskCss,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  } as const;
  const headingCls = "font-black tracking-tight leading-[0.95] text-5xl sm:text-6xl";
  return (
    <div className="mb-10 select-none text-center">
      <div className="relative">
        <h1 aria-hidden className={headingCls} style={{ color: reachBase }}>Reach for</h1>
        <h1 aria-hidden className={`absolute inset-0 ${headingCls}`} style={{ color: reachMask, ...maskStyle }}>Reach for</h1>
      </div>
      <div className="relative">
        <h1 aria-hidden className={headingCls} style={{ color: dollarsBase }}>Dollars</h1>
        <h1 aria-hidden className={`absolute inset-0 ${headingCls}`} style={{ color: dollarsMask, ...maskStyle }}>Dollars</h1>
      </div>
      <span className="sr-only">Reach for Dollars</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.3l-6.2-5.2C29.1 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.6 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

