import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Mail, MessageSquare, Send, Phone, Voicemail, Target, Workflow, Building2,
  Check, X, ArrowRight, Shield, Clock, Quote, ChevronDown, Play, Skull,
  AlertTriangle, Layers, Sparkles,
} from "lucide-react";

import { StickyNav } from "@/components/landing/StickyNav";
import { Grain } from "@/components/landing/Grain";
import { Reveal } from "@/components/landing/Reveal";
import { Counter } from "@/components/landing/Counter";
import { SurroundHero } from "@/components/landing/SurroundHero";
import { LogoMarquee } from "@/components/landing/LogoMarquee";
import { MathCalculator } from "@/components/landing/MathCalculator";
import { WeekTimeline } from "@/components/landing/WeekTimeline";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { AccessTracker } from "@/components/landing/AccessTracker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The engine — List vendors sell you the list. We book you the meeting." },
      { name: "description", content: "The 5-channel outbound engine for agencies. Email, SMS, DM, cold call, ringless voicemail — straight to the decision maker's mobile. Replaces six tools with one." },
      { property: "og:title", content: "The engine — List vendors sell you the list. We book you the meeting." },
      { property: "og:description", content: "Surround every decision maker on 5 channels until they answer. Built for agencies." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="r4d-obsidian min-h-screen overflow-x-hidden relative" style={{ fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif' }}>
      <Grain />
      <StickyNav />
      <Hero />
      <TrustBar />
      <Problem />
      <MathSection />
      <Sequence />
      <Engine />
      <VsStack />
      <Results />
      <WhoFor />
      <Founder />
      <Pricing />
      <RiskReversal />
      <HowAccess />
      <FAQ />
      <FinalCTA />
      <Footer />
      <VideoModalRoot />
    </div>
  );
}

/* ============================== 1) HERO ============================== */

function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 50, y: 40 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      setMouse({
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      });
    };
    const el = ref.current;
    el?.addEventListener("mousemove", onMove);
    return () => el?.removeEventListener("mousemove", onMove);
  }, [reduce]);

  return (
    <section
      ref={ref}
      className="relative pt-32 md:pt-40 pb-20 md:pb-28 px-6 bg-black overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{
          background: `radial-gradient(circle 480px at ${mouse.x}% ${mouse.y}%, rgba(198,244,50,0.14), transparent 70%)`,
          transition: "background 120ms linear",
        }}
      />
      <div className="max-w-7xl mx-auto relative grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <Reveal>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-6">
              The outbound engine for agencies done with Apollo
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="font-black tracking-tight text-[40px] leading-[1.05] md:text-[72px] md:leading-[1.02] text-white mb-6">
              List vendors sell you the list.<br />
              We <span className="r4d-lime">book</span> you the meeting.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed">
              Every other agency is buying the same 200M contacts and emailing them once.
              the engine runs a 5-channel surround sequence — email, SMS, DM, cold call, ringless voicemail —
              straight to the decision-maker's mobile. They reply, or they block you on five things at once.
              Either way, you stop getting ignored.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
              <a
                href="#pricing"
                className="group inline-flex items-center justify-center gap-2 r4d-bg-lime hover:opacity-90 text-black font-bold px-7 py-4 rounded-xl r4d-glow-lime text-base transition"
              >
                See pricing & get access
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </a>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("r4d:open-video"))}
                className="inline-flex items-center justify-center gap-2 border border-white/15 hover:border-white/30 text-white font-semibold px-6 py-4 rounded-xl transition"
              >
                <Play className="w-4 h-4 r4d-lime" /> Watch the 90-sec breakdown
              </button>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 text-xs text-zinc-500 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Secure checkout via Whop · Manual approval keeps the platform clean · Cancel anytime.
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-5">
          <Reveal delay={0.2}>
            <SurroundHero />
            <p className="text-center text-xs text-zinc-500 mt-4">
              Same person. Five channels. One week. No way out.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================== 2) TRUST BAR ============================== */

function TrustBar() {
  return (
    <section className="py-10 border-y border-white/5 bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-6">
          Booking 30+ meetings/mo for lead-gen, SaaS, SMMA, recruiting &amp; B2B agencies
        </p>
        <LogoMarquee />
      </div>
    </section>
  );
}

/* ============================== 3) PROBLEM ============================== */

function Problem() {
  const cards = [
    {
      icon: Skull,
      title: "The List Trap",
      hi: "Same list. Everyone.",
      body: "List resellers all resell the same 200M records to every agency on earth. By the time a lead hits your sequence, 40 other agencies already burned it this quarter. Your copy isn't the problem. The prospect is numb.",
    },
    {
      icon: AlertTriangle,
      title: "The Gatekeeper Tax",
      hi: "Wrong human. Every dial.",
      body: "Cold-calling shops dial the front desk and pitch a receptionist who couldn't buy if she wanted to. You pay per dial to leave voicemails on a company line the CEO will never check. The actual decision-maker doesn't know you exist.",
    },
    {
      icon: Workflow,
      title: "The One-Channel Failure",
      hi: "Email-only = ignored.",
      body: "Email alone replies at 1–2%. A cold call alone dies at the switchboard. A DM alone gets buried. Single channels don't break through anymore — they get filtered before they're read.",
    },
    {
      icon: Layers,
      title: "The Frankenstein Stack",
      hi: "Six tools, one VA, zero system.",
      body: "So you stitch it together: a sender + a dialer + an outreach tool + a scraper + a skip-trace tool + a VA to babysit it all. Six logins, six bills, six things that break — and a 'system' that lives in one person's head. That's not outbound. That's a part-time job you didn't apply for.",
    },
  ];

  return (
    <section className="py-24 md:py-28 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">Why outbound is broken</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              Your agency isn't bad at outbound.<br />
              Your tools are <span className="r4d-lime">obsolete</span>.
            </h2>
            <p className="text-zinc-400 mt-5">
              Three things are quietly killing your reply rate — and a fourth is quietly killing your margin.
            </p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-5">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.05}>
              <div className="group h-full rounded-2xl border-t-2 border-t-[#C6F432] border border-white/10 bg-[#0A0A0A] p-7 transition hover:-translate-y-1 hover:border-white/20">
                <div className="w-11 h-11 rounded-xl border border-white/10 flex items-center justify-center mb-5 transition group-hover:r4d-bg-lime group-hover:border-[#C6F432]">
                  <c.icon className="w-5 h-5 text-white transition group-hover:text-black" strokeWidth={1.75} />
                </div>
                <h3 className="font-bold text-xl text-white mb-1">{c.title}</h3>
                <div className="text-sm font-bold r4d-lime mb-3">{c.hi}</div>
                <p className="text-sm text-zinc-400 leading-relaxed">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== 4) THE MATH ============================== */

function MathSection() {
  return (
    <section className="py-24 md:py-28 px-6 bg-[#0A0A0A]">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">The math</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              Here's what one month of "good enough" outbound actually <span className="r4d-lime">costs</span> you.
            </h2>
            <p className="text-zinc-400 mt-5">
              Plug in your own numbers. The gap is the deal flow you're leaving on the table.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <MathCalculator />
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== 5) THE SEQUENCE ============================== */

function Sequence() {
  const steps = [
    { icon: Mail, label: "Email", body: "Personalized opener referencing their role, a company event, or a recent move. Sent from a warmed domain that lands in the inbox, not spam." },
    { icon: MessageSquare, label: "SMS", body: "Direct to their mobile (skip-traced + DNC-scrubbed). No company line, no gatekeeper. Pattern-interrupts the email." },
    { icon: Send, label: "DM", body: "LinkedIn + Instagram with a contextual hook. Lands where they actually scroll, not where they fight inbox-zero." },
    { icon: Phone, label: "Cold call", body: "Direct dial to the decision-maker's mobile. Your closer — or our AI dialer — talks to the buyer, never the front desk." },
    { icon: Voicemail, label: "Ringless voicemail", body: "A 30-second drop straight into their voicemail. No ring, no interruption. The closer that ties the week together." },
  ];

  return (
    <section id="sequence" className="py-24 md:py-28 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">The sequence</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              5 channels. One decision-maker. <span className="r4d-lime">Zero</span> escape.
            </h2>
            <p className="text-zinc-400 mt-5">
              Every prospect runs the full sequence — spaced, personalized, stop-on-reply. When the same name hits their inbox, phone, DMs, and voicemail in one week, they don't ignore it. They respond.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-16">
          {steps.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.04}>
              <div className="h-full rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 hover:border-[#C6F432]/40 transition">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg r4d-bg-lime flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-black" />
                  </div>
                  <span className="font-mono text-xs text-zinc-600">0{i + 1}</span>
                </div>
                <h3 className="font-bold text-white mb-2">{s.label}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <h3 className="font-black text-2xl md:text-3xl text-white text-center mb-3 tracking-tight">
            A week in the life of <span className="r4d-lime">one</span> prospect.
          </h3>
          <p className="text-center text-zinc-400 max-w-2xl mx-auto mb-10">
            Stop-on-reply across all channels. Time-zone aware. Compliance gates on every send.
          </p>
        </Reveal>
        <Reveal>
          <WeekTimeline />
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-8 max-w-3xl mx-auto text-center text-zinc-300 leading-relaxed italic">
            "Monday she ignores the email. Wednesday a text she didn't expect. Friday a DM that mentions her funding round. Monday her phone rings — and it's not the front desk. Tuesday a voicemail she actually listens to. By Thursday she replies: <span className="r4d-lime not-italic font-semibold">'Okay, you've got 15 minutes.'</span>"
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== 6) THE ENGINE ============================== */

function Engine() {
  const pillars = [
    {
      icon: Target,
      eyebrow: "Decision-Maker Discovery",
      title: "Skip the company. Find the buyer.",
      body: "Pull verified mobile, work email, personal email, LinkedIn, and Instagram for the exact human who signs the check — CMO, Head of Growth, VP Sales, Founder. Filtered by company size, tech stack, funding round, hiring signals, and recent role changes.",
      bullets: [
        "5-provider waterfall (94% mobile coverage)",
        "Triggered by hiring + funding + role-change signals",
        "Federal & state DNC scrubbed automatically",
      ],
      micro: <ContactRowsMicro />,
    },
    {
      icon: Workflow,
      eyebrow: "5-Channel Orchestration",
      title: "One workflow runs everything.",
      body: "Drag the prospect into the sequence — the engine handles the rest. When to email, when to text, when the dialer fires, when the RVM drops, when the DM goes out. Stop-on-reply across all channels. Time-zone aware. Compliance gates on every send.",
      bullets: [
        "Visual sequence builder, no code",
        "Spintax + AI personalization per prospect",
        "Stop-on-reply syncs across all 5 channels",
      ],
      micro: <LanePulseMicro />,
    },
    {
      icon: Building2,
      eyebrow: "Agency-Grade Control Room",
      title: "Run 10 clients without 10 logins.",
      body: "Sub-accounts per client. White-labeled subdomain. Per-client inboxes, dialers, domains, and reporting. Your team runs everything from one console; your clients see clean dashboards. Bill them, track ROI, scale headcount instead of tabs.",
      bullets: [
        "Unlimited sub-accounts (Enterprise)",
        "White-label + custom subdomain",
        "Per-client deliverability + compliance",
      ],
      micro: <TilesStackMicro />,
    },
  ];

  return (
    <section id="engine" className="py-24 md:py-28 px-6 bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">The engine</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              One platform. Five channels. <span className="r4d-lime">Replaces</span> your entire outbound stack.
            </h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-5">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.07}>
              <div className="h-full rounded-2xl border border-white/10 bg-black flex flex-col">
                <div className="aspect-[5/3] border-b border-white/10 overflow-hidden relative">{p.micro}</div>
                <div className="p-7 flex-1 flex flex-col">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3 flex items-center gap-2">
                    <p.icon className="w-3.5 h-3.5" /> {p.eyebrow}
                  </div>
                  <h3 className="font-black text-xl text-white mb-3 tracking-tight">{p.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-5">{p.body}</p>
                  <ul className="space-y-2 mt-auto">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <Check className="w-4 h-4 r4d-lime mt-0.5 shrink-0" strokeWidth={3} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactRowsMicro() {
  const rows = ["Mobile", "Personal email", "LinkedIn", "Instagram"];
  return (
    <div className="absolute inset-0 p-5 flex flex-col justify-center gap-2">
      {rows.map((r, i) => (
        <motion.div
          key={r}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.4, duration: 0.4, repeat: Infinity, repeatType: "reverse", repeatDelay: 3 }}
          className="flex items-center justify-between text-xs px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/10"
        >
          <span className="text-zinc-500">{r}</span>
          <span className="r4d-lime font-mono text-[10px]">verified ✓</span>
        </motion.div>
      ))}
    </div>
  );
}

function LanePulseMicro() {
  return (
    <div className="absolute inset-0 p-5 flex flex-col justify-center gap-2">
      {[Mail, MessageSquare, Send, Phone, Voicemail].map((I, i) => (
        <div key={i} className="flex items-center gap-3">
          <I className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <div className="relative flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.span
              className="absolute inset-y-0 left-0 w-1/3 r4d-bg-lime rounded-full"
              animate={{ x: ["0%", "200%"] }}
              transition={{ duration: 3, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TilesStackMicro() {
  return (
    <div className="absolute inset-0 p-5 grid grid-cols-3 gap-2 content-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.12, duration: 0.4, repeat: Infinity, repeatType: "reverse", repeatDelay: 2 }}
          className="aspect-square rounded-md border border-white/10 bg-white/[0.03] flex items-center justify-center"
        >
          <Building2 className="w-3.5 h-3.5 text-zinc-600" />
        </motion.div>
      ))}
    </div>
  );
}

/* ============================== 7) VS YOUR STACK ============================== */

function VsStack() {
  return (
    <section className="py-24 md:py-28 px-6 bg-black">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">vs. your current stack</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              List vendors give you the list. The engine <span className="r4d-lime">closes</span> the loop.
            </h2>
          </div>
        </Reveal>
        <Reveal>
          <ComparisonTable />
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== 8) RESULTS / PROOF ============================== */

function Results() {
  const stats = [
    { value: 8.4, suffix: "%", decimals: 1, label: "Avg reply rate across 5 channels" },
    { value: 37, suffix: "%", label: "Of meetings booked from RVM or SMS — not email" },
    { value: 14, prefix: "<", suffix: " days", label: "Signup to first booked meeting" },
    { value: 6, suffix: " → 1", label: "Tools replaced per agency" },
  ];

  // {/* TODO: replace with real testimonials before going live */}
  const cases = [
    {
      quote: "One 6-person B2B agency went from 4 booked calls/mo on their old list tool to 31 in their first 6 weeks on the engine.",
      who: "Founder, One 6-person B2B agency Agency",
    },
    {
      quote: "We killed five subscriptions and a VA seat. The engine replaced the whole thing and our reply rate doubled.",
      who: "Ops Lead, Outbound Republic",
    },
    {
      quote: "The RVM channel alone books a third of our meetings. Nobody else even offers it.",
      who: "Partner, Velocity B2B",
    },
  ];

  return (
    <section className="py-24 md:py-28 px-6 bg-[#0A0A0A]">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">Proof</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              Less list-renting. <span className="r4d-lime">More</span> booked calls.
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.05}>
              <div className="rounded-2xl border border-white/10 bg-black p-6 text-center h-full">
                <div className="font-black text-3xl md:text-4xl r4d-lime tracking-tight">
                  <Counter to={s.value} decimals={s.decimals ?? 0} prefix={s.prefix ?? ""} suffix={s.suffix ?? ""} />
                </div>
                <div className="text-xs text-zinc-400 mt-2 leading-snug">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {cases.map((c, i) => (
            <Reveal key={c.who} delay={i * 0.07}>
              {/* TODO: replace with real testimonial before going live */}
              <div className="h-full rounded-2xl border border-white/10 bg-black p-7 flex flex-col">
                <Quote className="w-6 h-6 r4d-lime mb-4" />
                <p className="text-zinc-200 leading-relaxed flex-1">{c.quote}</p>
                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-white/5">
                  <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10" />
                  <span className="text-xs text-zinc-400">{c.who}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== 9) WHO IT'S FOR ============================== */

function WhoFor() {
  const fors = [
    "you run a lead-gen / SaaS / SMMA / recruiting / B2B agency",
    "you're booking meetings for clients or yourself",
    "you're sick of paying for lists that go nowhere",
    "you want one engine instead of six tools",
    "you can handle volume and want more",
  ];
  const notFors = [
    "you want a free trial to scrape and dip",
    "you're spamming with no offer",
    "you expect meetings without a real sequence",
    "you want self-serve with zero approval",
  ];

  return (
    <section className="py-24 md:py-28 px-6 bg-black">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-14 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">Fit check</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              Built for <span className="r4d-lime">operators</span>. Not for tire-kickers.
            </h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-5">
          <Reveal>
            <div className="rounded-2xl border border-[#C6F432]/30 bg-[#C6F432]/[0.04] p-7 h-full">
              <h3 className="font-bold text-white text-lg mb-5">This is for you if</h3>
              <ul className="space-y-3">
                {fors.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-zinc-200">
                    <Check className="w-5 h-5 r4d-lime mt-0.5 shrink-0" strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-7 h-full">
              <h3 className="font-bold text-white text-lg mb-5">This is NOT for you if</h3>
              <ul className="space-y-3 mb-6">
                {notFors.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-zinc-400">
                    <X className="w-5 h-5 text-zinc-600 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-zinc-500 italic border-t border-white/5 pt-4">
                We manually approve every account to protect deliverability for everyone on the platform. If that annoys you, this isn't it.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================== 10) FOUNDER ============================== */

function Founder() {
  return (
    <section className="py-24 md:py-28 px-6 bg-[#0A0A0A]">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">Founder's note</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              Why we built <span className="r4d-lime">the engine</span>.
            </h2>
          </div>
        </Reveal>
        <Reveal>
          {/* Founder voice — anonymized */}
          <div className="relative rounded-2xl border border-white/10 bg-black p-8 md:p-10">
            <div className="absolute top-4 bottom-4 left-0 w-1 r4d-bg-lime rounded-r" />
            <p className="text-zinc-200 leading-relaxed text-lg pl-4">
              "I ran a cold-calling agency for years. I watched great offers die because the lead was burned, the gatekeeper won, or the follow-up lived in one VA's head. The tools weren't the edge anymore — everyone had the same list. So we built the thing we wished existed: one engine that finds the actual buyer and surrounds them on every channel until they answer. The engine is that engine."
            </p>
            <div className="pl-4 mt-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full r4d-bg-lime flex items-center justify-center text-black font-black">M</div>
              <div>
                <div className="text-white font-bold">— The founder</div>
                <div className="text-xs text-zinc-500">Founder</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== 11) PRICING ============================== */

function Pricing() {
  const [annual, setAnnual] = useState(false);
  const plans = [
    {
      slug: "starter",
      name: "Starter Engine",
      price: 149,
      seats: 1,
      features: [
        "1,500 decision-maker contacts/mo",
        "5-channel sequence",
        "Verified mobile + personal email",
        "Pipeline + CRM",
      ],
    },
    {
      slug: "professional",
      name: "Professional Engine",
      price: 499,
      seats: 3,
      featured: true,
      features: [
        "6,000 contacts/mo",
        "Everything in Starter",
        "Team inbox",
        "Advanced sequences + A/B",
        "Priority enrichment",
        "Slack + CRM integrations",
      ],
    },
    {
      slug: "enterprise",
      name: "Enterprise Engine",
      price: 999,
      seats: 10,
      features: [
        "20,000+ contacts/mo",
        "Everything in Pro",
        "Sub-accounts",
        "White-glove onboarding",
        "Dedicated success manager",
        "Custom data + API",
      ],
    },
  ];

  return (
    <section id="pricing" className="py-24 md:py-28 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">Pricing</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              Pick your engine. Start <span className="r4d-lime">surrounding</span> buyers.
            </h2>
            <p className="text-zinc-400 mt-5">
              Secure checkout. After payment you're redirected to claim access.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="flex items-center justify-center gap-3 mb-10">
            <button
              onClick={() => setAnnual(false)}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition ${!annual ? "r4d-bg-lime text-black" : "text-zinc-400 hover:text-white"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-2 ${annual ? "r4d-bg-lime text-black" : "text-zinc-400 hover:text-white"}`}
            >
              Annual
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${annual ? "bg-black text-[#C6F432]" : "bg-[#C6F432]/15 r4d-lime"}`}>
                Save 2 months
              </span>
            </button>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p, i) => {
            const displayPrice = annual ? Math.round(p.price * 10 / 12) : p.price;
            return (
              <Reveal key={p.slug} delay={i * 0.05}>
                <div
                  className={`relative h-full rounded-3xl p-8 transition flex flex-col ${
                    p.featured
                      ? "border-2 border-[#C6F432] bg-[#0A0A0A] r4d-glow-lime md:scale-[1.02]"
                      : "border border-white/10 bg-[#0A0A0A] hover:border-white/20"
                  }`}
                >
                  {p.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 r4d-bg-lime text-black text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full">
                      Most popular
                    </div>
                  )}
                  <h3 className="font-bold text-xl text-white">{p.name}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{p.seats} seat{p.seats > 1 ? "s" : ""}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-5xl font-black text-white">${displayPrice}</span>
                    <span className="text-zinc-500">/mo</span>
                  </div>
                  {annual && <p className="text-xs text-zinc-500 mt-1">billed annually</p>}

                  {/* Pricing CTA → /pricing keeps the existing checkout flow (source of truth) */}
                  <Link
                    to="/pricing"
                    className={`mt-6 flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition ${
                      p.featured
                        ? "r4d-bg-lime hover:opacity-90 text-black"
                        : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    }`}
                  >
                    Checkout {p.name} <ArrowRight className="w-4 h-4" />
                  </Link>

                  <ul className="mt-8 space-y-3 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-zinc-300">
                        <Check className="w-4 h-4 r4d-lime mt-0.5 shrink-0" strokeWidth={3} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2 flex-wrap">
          <Shield className="w-3.5 h-3.5" />
          Payments secured · Manual approval before access · Cancel anytime.
        </p>
      </div>
    </section>
  );
}

/* ============================== 12) RISK REVERSAL ============================== */

function RiskReversal() {
  return (
    <section className="py-20 md:py-24 px-6 bg-[#0A0A0A]">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          {/* Guarantee terms — confirm before publishing */}
          <div className="rounded-3xl border-2 border-[#C6F432] bg-black p-8 md:p-12 r4d-glow-lime">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="w-14 h-14 rounded-2xl r4d-bg-lime flex items-center justify-center shrink-0 relative">
                <Shield className="w-7 h-7 text-black" strokeWidth={2.25} />
                <Clock className="w-3.5 h-3.5 text-black absolute -bottom-1 -right-1 bg-[#C6F432] rounded-full p-0.5" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h2 className="font-black text-2xl md:text-4xl text-white tracking-tight leading-tight mb-4">
                  Book a meeting in 14 days, or we keep working for <span className="r4d-lime">free</span>.
                </h2>
                <p className="text-zinc-300 leading-relaxed">
                  Run the sequence as we set it up. If you haven't booked your first qualified meeting within 14 days of activation, we'll extend your access and work your sequences with you until you do — no extra charge. We can offer this because the engine works when it's actually run.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== 13) HOW ACCESS ============================== */

function HowAccess() {
  return (
    <section className="py-24 md:py-28 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">How access works</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              From payment to launch in <span className="r4d-lime">under</span> an hour.
            </h2>
          </div>
        </Reveal>
        <Reveal>
          <AccessTracker />
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== 14) FAQ ============================== */

function FAQ() {
  const items = [
    { q: "Is this just another list-vendor wrapper?", a: "No. The engine pulls from a 5-provider waterfall for mobile and personal email — one may be a source we use, but the engine is the orchestration across email, SMS, DM, cold call, and RVM, not a list resale." },
    { q: "Do I need my own phone numbers and sending domains?", a: "On Starter we provision your dialer numbers and sending domains. Pro and Enterprise can BYO if you already have warmed assets." },
    { q: "How is this different from a cold-calling agency?", a: "Cold-calling agencies dial gatekeepers all day. The engine dials decision-makers on their mobile after they've already seen your email, text, and DM — so the conversation actually starts." },
    { q: "What about TCPA / DNC compliance?", a: "Every contact is federal + state DNC scrubbed before any send, and compliance gates block non-compliant sends from leaving your workspace." },
    { q: "Can my team use it for multiple clients?", a: "Yes — Pro supports a team inbox; Enterprise adds full sub-accounts with white-label subdomain, per-client inboxes, dialers, and reporting." },
    { q: "How long does setup take?", a: "Most agencies are live within a day of approval. Domain warm-up runs in the background; you can start the sequence on day one." },
    { q: "What happens after I pay?", a: "Checkout redirects you to /signup. Enter the email you paid with, we manually approve you (no bots), email you a one-time 6-digit code, and you activate the account." },
    { q: "Is there a contract?", a: "No annual lock-in by default. Cancel anytime." },
    { q: "How fast until I see meetings?", a: "Most agencies book their first qualified meeting inside 14 days of activation, often sooner once domains are warm and the sequence is live." },
    { q: "Do you provide the data or do I bring it?", a: "Both. The engine discovers decision-makers for you with a 5-provider waterfall, and you can import your own lists too." },
    { q: "Is the AI dialer compliant?", a: "Every dial, SMS, and RVM passes federal + state DNC scrubbing first, and compliance gates block non-compliant sends from leaving your workspace." },
    { q: "What happens if I cancel?", a: "Cancel anytime — no ticket. Your account stays active through the end of the billing period." },
    { q: "Can I white-label it for my clients?", a: "Yes, on Enterprise: custom subdomain, per-client inboxes, dialer numbers, and reporting." },
  ];

  return (
    <section id="faq" className="py-24 md:py-28 px-6 bg-[#0A0A0A]">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] r4d-lime mb-3">FAQ</div>
            <h2 className="font-black text-[32px] md:text-[48px] text-white tracking-tight leading-[1.05]">
              Straight <span className="r4d-lime">answers</span>.
            </h2>
          </div>
        </Reveal>
        <div className="space-y-3">
          {items.map((item, i) => (
            <Reveal key={item.q} delay={Math.min(i, 6) * 0.03}>
              <FAQItem q={item.q} a={item.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-black overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 py-5 flex items-center justify-between text-left gap-4"
        aria-expanded={open}
      >
        <span className="font-semibold text-white">{q}</span>
        <ChevronDown className={`w-4 h-4 r4d-lime shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-zinc-400 leading-relaxed">{a}</div>
      )}
    </div>
  );
}

/* ============================== 15) FINAL CTA ============================== */

function FinalCTA() {
  return (
    <section className="relative py-28 md:py-36 px-6 bg-black overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30"
      >
        <div className="w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(198,244,50,0.18), transparent 60%)" }}
        />
      </div>
      <div className="max-w-3xl mx-auto text-center relative">
        <Reveal>
          <h2 className="font-black text-[36px] md:text-[60px] text-white tracking-tight leading-[1.05]">
            Stop renting lists. <span className="r4d-lime">Start owning meetings.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="text-zinc-400 mt-6 text-lg max-w-xl mx-auto">
            Every day you wait, a competitor books another call with a buyer you could have surrounded on five channels at once.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <a
            href="#pricing"
            className="group mt-10 inline-flex items-center gap-2 r4d-bg-lime hover:opacity-90 text-black font-bold px-8 py-5 rounded-2xl r4d-glow-lime text-lg transition"
          >
            Get Access Now
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </a>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-5 text-xs text-zinc-500">
            Secure checkout · Manual approval · Cancel anytime.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== 16) FOOTER ============================== */

function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 items-start mb-10">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg r4d-bg-lime flex items-center justify-center">
                <Target className="w-4 h-4 text-black" strokeWidth={2.5} />
              </div>
              <span className="font-black text-lg text-white">the engine</span>
            </Link>
            <p className="text-sm text-zinc-500 max-w-xs">
              The 5-channel outbound engine for agencies.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400 md:col-span-2 md:justify-end">
            <a href="#sequence" className="hover:text-white transition">The Sequence</a>
            <a href="#engine" className="hover:text-white transition">Engine</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <Link to="/login" className="hover:text-white transition">Sign in</Link>
            <Link to="/legal/privacy" className="hover:text-white transition">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-white transition">Terms</Link>
          </div>
        </div>
        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <span>© 2026 the engine. All rights reserved.</span>
          <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3 r4d-lime" /> Built for operators.</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================== Video modal (placeholder) ============================== */

function VideoModalRoot() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("r4d:open-video", onOpen);
    return () => window.removeEventListener("r4d:open-video", onOpen);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setOpen(false)}>
      <div
        className="relative w-full max-w-3xl aspect-video rounded-2xl border border-white/10 bg-[#0A0A0A] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TODO: replace with real 90-sec breakdown video before going live */}
        <div className="text-center px-6">
          <Play className="w-12 h-12 r4d-lime mx-auto mb-4" />
          <p className="text-white font-bold text-lg">90-sec breakdown coming soon.</p>
          <p className="text-zinc-500 text-sm mt-2">Drop your video URL here to enable playback.</p>
        </div>
        <button onClick={() => setOpen(false)} className="absolute top-3 right-3 w-9 h-9 rounded-lg border border-white/10 text-white flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
