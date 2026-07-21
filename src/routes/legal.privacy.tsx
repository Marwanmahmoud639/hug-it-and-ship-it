import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — R4D" },
      { name: "description", content: "Reach for Dollars Privacy Policy." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="r4d-obsidian min-h-screen text-white" style={{ fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif' }}>
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link to="/" className="text-emerald-400 text-sm">← Back home</Link>
        <h1 className="text-4xl font-black mt-6 mb-8">Privacy Policy</h1>
        <div className="prose prose-invert max-w-none text-white/70 space-y-6">
          <p>Last updated: June 12, 2026.</p>
          <h2 className="text-xl font-bold text-white">What we collect</h2>
          <p>Account info (name, email, company), billing identifiers from our payment processor, and usage analytics. We do not sell personal data.</p>
          <h2 className="text-xl font-bold text-white">How we use it</h2>
          <p>To operate the service, send transactional emails, prevent fraud, and improve discovery models.</p>
          <h2 className="text-xl font-bold text-white">Third parties</h2>
          <p>We rely on Supabase (auth & database), Whop (payments), and email infrastructure providers. Each is bound by their own privacy terms.</p>
          <h2 className="text-xl font-bold text-white">Your rights</h2>
          <p>You can request export or deletion of your account data at <a className="text-emerald-400" href="mailto:privacy@dialingfordollars.co">privacy@dialingfordollars.co</a>.</p>
          <h2 className="text-xl font-bold text-white">Cookies</h2>
          <p>We use first-party cookies for authentication and analytics only. No third-party ad tracking.</p>
        </div>
      </div>
    </div>
  );
}
