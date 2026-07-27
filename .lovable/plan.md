## Goal
Cover every US city/state in Discovery, run a 10-level decision-maker cascade before giving up, and when the DM truly can't be found, save the business with a B2B badge, route it to a dedicated pipeline stage, charge 0.5 credit, and expose a manual "Retry DM search" button.

## Scope (US-only for now)
- Lock discovery to `country = "US"` (Canada stays deferred).
- Discovery city/state input: validated 50-state dropdown + free-text city + optional ZIP. Backend expands ZIP → city/state via a lightweight lookup so no city is missed.

## 10-Level DM cascade (in order)
Runs per business before falling back to business-only:
1. Website scrape (`/contact`, `/about`, footer) via Firecrawl — extract owner/founder name + role.
2. LinkedIn company page → "People" section (via Serper `site:linkedin.com/in`).
3. Google search: `"<Company>" (owner OR founder OR CEO OR president) site:linkedin.com/in`.
4. Apollo / Hunter enrichment (if team API key configured).
5. State Secretary-of-State registry search (`site:sos.<state>.gov <Company>`).
6. LLC / public records (`site:opencorporates.com` + `bizapedia.com`).
7. Facebook business page "About" scrape.
8. Google Maps "owner responses" → author name of owner replies.
9. Clearbit / PDL enrichment (if team keys present).
10. Wide Serper / DuckDuckGo fallback with strict identity match (name + company OR city must both appear in snippet).

If any level returns a name that passes strict identity match → stop, save as normal DM lead (1 credit).
If all 10 fail → save as **business-only fallback**.

## Business-only fallback (cross-verified)
Sources tried in parallel:
- Website `/contact` scrape → `info@`, `sales@`, main phone.
- Google Business Profile (Maps API) → phone, website, hours.
- Facebook page → phone, email.
- Yelp business page → phone.

Marked `verified = true` when the same email or phone appears in 2+ sources.
Saved with:
- `business_only = true`
- Small orange **"B2B"** badge on lead cards + drawer
- Auto-routed to a new pipeline stage: **"Needs DM Research"** (created for every team, seeded ahead of the "New Lead" stage)
- Charged **0.5 credit** instead of 1
- `dm_search_attempts = 1`, `dm_last_retry_at = now()`

## Manual retry
- "Retry DM search" button on the Lead drawer and Contact detail for any `business_only = true` lead.
- Re-runs the same 10-level cascade; on success: clears `business_only`, moves lead out of "Needs DM Research" into "New Lead", charges the remaining 0.5 credit, updates `dm_search_attempts++`.

## Credits (half-credit support)
- Migrate `teams.credits_used` from `integer` → `numeric(12,2)`.
- Update `consume_credits(_team_id, _amount numeric, _kind)` signature and `tg_charge_contact_credit` trigger:
  - `business_only` insert → `_amount = 0.5`
  - Regular DM insert → `_amount = 1`
- Credits badge UI rounds display to whole numbers but preserves halves in tooltip.

## Database changes (one migration)
- `contacts`: add `business_only boolean default false`, `dm_search_attempts int default 0`, `dm_last_retry_at timestamptz`, `business_verified_sources text[] default '{}'`.
- `teams.credits_used` → `numeric(12,2)`.
- Backfill: insert **"Needs DM Research"** stage at position -1 for every existing team.
- Update `create_sub_account()` and `handle_new_user()` to seed the new stage.
- Update `consume_credits` + `tg_charge_contact_credit` for numeric amounts and `business_only` awareness.

## Files touched
- `supabase/functions/discovery-run/index.ts` — 10-level cascade, US-only guard, business-only fallback path.
- `supabase/functions/discovery-run/scrapers/` — add `dm-cascade.ts` (10 levels), `business-fallback.ts` (cross-verify sources), `us-locations.ts` (state list + ZIP resolver).
- `src/lib/discovery.functions.ts` — pass `strictIdentityMatch: true` always, expose new `retryDMSearch(contactId)` server fn.
- `src/routes/_app.discovery.tsx` — 50-state dropdown, free-text city + optional ZIP, US-only (drop CA toggle for now).
- `src/components/areas/LeadPinCard.tsx` + `src/components/contacts/lead-drawer.tsx` — B2B badge, Retry button, "verified 2+ sources" indicator.
- `src/lib/lead-tools.functions.ts` — `retryDMSearch` handler that re-runs cascade + adjusts credits + moves pipeline stage.
- `src/components/app-shell/discovery-credits-badge.tsx` — render fractional totals cleanly.

## Not in scope
- Canada support (deferred).
- Automatic weekly retry cron (user chose manual only).
- Changes to skip-tracing, email warmup, or AI caller.

Confirm and I'll ship the migration + code in one build.