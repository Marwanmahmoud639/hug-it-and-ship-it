import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Clock, Mail, ArrowRight, RefreshCw } from "lucide-react";

const searchSchema = z.object({
  email: z.string().email().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/signup/pending")({
  validateSearch: searchSchema,
  component: PendingPage,
});

function PendingPage() {
  const { email, status } = useSearch({ from: "/signup/pending" });
  const awaitingWebhook = status === "awaiting_webhook";
  return (
    <div className="r4d-obsidian min-h-screen flex flex-col" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <Link to="/" className="font-black text-white" style={{ fontFamily: "Sora, sans-serif" }}>REACH<span className="r4d-lime">.</span></Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl r4d-glass-lime mx-auto flex items-center justify-center r4d-glow-lime-sm">
            <Clock className="w-7 h-7 text-lime-400" />
          </div>
          <h1 className="text-3xl font-black text-white mt-6 tracking-tight" style={{ fontFamily: "Sora, sans-serif" }}>
            {awaitingWebhook ? "We're confirming your payment" : "Queued for approval"}
          </h1>
          <p className="text-zinc-400 mt-3 text-[15px]">
            {awaitingWebhook
              ? "It can take up to a couple of minutes for the payment confirmation to reach us. You'll get an email with your one-time access code as soon as you're approved."
              : "Thanks — an operator is reviewing your account right now. You'll receive an email with your one-time access code within 1 business hour."}
          </p>
          {email && (
            <div className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-400 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2">
              <Mail className="w-4 h-4 text-lime-400" /> {email}
            </div>
          )}
          <div className="mt-10 grid gap-3">
            <Link
              to="/activate"
              search={{ email }}
              className="r4d-bg-lime hover:opacity-90 text-black font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2"
            >
              I already have my code <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/signup"
              search={{}}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Check status again
            </Link>
          </div>
          <p className="mt-8 text-xs text-zinc-500">
            Need help? Email <a href="mailto:support@dialingfordollars.co" className="text-lime-400 hover:underline">support@dialingfordollars.co</a>
          </p>
        </div>
      </main>
    </div>
  );
}
