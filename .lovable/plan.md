## What's in the upload

The zip is a near-identical snapshot of the current codebase with a small delta focused on Settings/Billing, landing polish, and theming. No new SQL migrations vs. what's already applied.

## Files to import (from `/tmp/r4d2` → `/dev-server`)

New files:
- `src/components/settings/billing-panel.tsx`
- `src/components/settings/security-panel.tsx`
- `src/lib/billing.functions.ts`

Modified files (overwrite):
- `src/components/landing/*` — `AccessTracker.tsx`, `ComparisonTable.tsx`, `MathCalculator.tsx`, `StickyNav.tsx`, `SurroundHero.tsx`, `WeekTimeline.tsx`
- `src/components/areas/AreasMap.tsx`
- `src/components/settings/account-provisioning-card.tsx`, `appearance-panel.tsx`
- `src/lib/lookup.functions.ts`, `src/lib/provisioning.functions.ts`, `src/lib/theme.tsx`
- `src/routes/index.tsx`, `src/routes/_app.settings.tsx`
- `src/styles.css`
- `supabase/functions/discovery-run/index.ts`

## Files to preserve (do NOT overwrite)

- `.env`, `.git`, `.tanstack`, `.workspace` — sandbox/project state
- `src/integrations/supabase/client.ts`, `client.server.ts`, `types.ts`, `auth-*.ts` — auto-generated, bound to the live Lovable Cloud project
- `supabase/config.toml` — bound to current project id (the zip's toml points elsewhere)
- `supabase/migrations/*` — current DB already has all migrations from the zip plus 2 extra applied migrations; no new migration needed

## Steps

1. `rsync` the delta into `/dev-server` with excludes for the preserved paths above.
2. `bun install` to pick up any new deps (lockfile from zip is copied).
3. Wait for build/typecheck to pass.
4. Publish via `preview_ui--publish` so the changes go live at `reach4dollars.com`.

## Notes

- No database changes required.
- No secrets changes required.
- Existing Gmail/Whop/Supabase bindings are preserved.
