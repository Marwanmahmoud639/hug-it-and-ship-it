import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — R4D" },
      { name: "description", content: "Reach for Dollars Terms of Service." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="r4d-obsidian min-h-screen text-white" style={{ fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif' }}>
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link to="/" className="text-emerald-400 text-sm">← Back home</Link>
        <h1 className="text-4xl font-black mt-6 mb-8">Terms of Service</h1>
        <div className="prose prose-invert max-w-none text-white/70 space-y-6">
          <p>Last updated: June 12, 2026.</p>
          <h2 className="text-xl font-bold text-white">1. Acceptance</h2>
          <p>By using Reach for Dollars ("R4D", "we", "us"), you agree to these Terms. If you do not agree, do not use the service.</p>
          <h2 className="text-xl font-bold text-white">2. Subscriptions & billing</h2>
          <p>Plans are billed monthly via our payment processor. Cancel anytime — access continues through the end of the paid period. No refunds for partial months.</p>
          <h2 className="text-xl font-bold text-white">3. Acceptable use</h2>
          <p>You are responsible for complying with TCPA, CAN-SPAM, GDPR, state telemarketing laws, and DNC registries when contacting prospects sourced through R4D. Misuse will result in immediate termination.</p>
          <h2 className="text-xl font-bold text-white">4. Data & ownership</h2>
          <p>You own the leads and lists you generate. R4D retains the right to aggregate anonymized usage data to improve discovery models.</p>
          <h2 className="text-xl font-bold text-white">5. Limitation of liability</h2>
          <p>R4D is provided "as is". We disclaim all warranties. Total liability is capped at the fees paid in the prior 12 months.</p>
          <h2 className="text-xl font-bold text-white">6. Contact</h2>
          <p>Questions: <a className="text-emerald-400" href="mailto:support@dialingfordollars.co">support@dialingfordollars.co</a></p>
        </div>
      </div>
    </div>
  );
}
