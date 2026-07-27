## Goal
Replace the current project's source with the contents of `R4D-merged.zip` and get it deploying cleanly on Lovable (Cloud backend + published web app).

## What's in the upload
- ~458 files: `src/` (TanStack Start), `supabase/migrations/` (many), `supabase/functions/`, `capacitor.config.ts`, `netlify.toml`, `vite.config.ts`, `package.json`, `bun.lock`, `.github/`, `docs/`, etc.
- No `.git` directory (safe to copy).
- Includes its own `src/integrations/supabase/{client,client.server,auth-attacher,auth-middleware,types}.ts` — these are auto-generated per-project on Lovable and must NOT overwrite the current ones (they're bound to *this* project's Supabase ref/keys).
- Includes its own `supabase/config.toml` — auto-generated per project, must not overwrite.
- Includes `.env.example` (fine to keep as reference); no real `.env`.

## Plan

1. **Snapshot current auto-generated files** (do not overwrite them from the zip):
   - `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-attacher.ts`, `auth-middleware.ts`, `types.ts`
   - `supabase/config.toml`
   - `.env` (if any) and `.gitignore` project-local bits

2. **Wipe the working tree** except for `.git`, `node_modules`, and the snapshotted auto-gen files, then extract the zip on top with `rsync --exclude='.git' --exclude='src/integrations/supabase/*' --exclude='supabase/config.toml'`.

3. **Restore the snapshotted auto-gen files** so the app stays bound to this project's Lovable Cloud instance.

4. **Reconcile migrations**:
   - The zip's `supabase/migrations/` contains many timestamped files. Any already applied to this DB (same filename) are ignored by Supabase's migration runner. New ones will apply.
   - Risk: the zip may include migrations whose objects already exist (from earlier work in this project) and will fail. I'll dry-list new migrations first, then apply them one at a time via the migration tool, wrapping conflicting `CREATE` statements with `IF NOT EXISTS` / `DROP ... IF EXISTS` guards only when needed.
   - Any `ALTER`/data seeding that would break existing rows will be flagged and skipped, with a short note.

5. **Install deps and typecheck**: `bun install`, then run `tsgo` on the fresh tree. Fix any imports that reference the old (removed) files.

6. **Verify locally**:
   - Wait for dev server to answer on `:8080`.
   - Open `/` and `/dashboard` in Playwright, screenshot, check console + network for errors.

7. **Publish** to `hug-it-and-ship-it.lovable.app` (existing slug) once the build is clean.

## Things I will explicitly NOT touch
- `.git/`
- `src/integrations/supabase/*` (auto-generated for this project's Cloud instance)
- `supabase/config.toml` (project-level)
- Project secrets (already set: GOOGLE_API_KEY, HUNTER_API_KEY, LOVABLE_API_KEY, etc.)
- Storage buckets and existing DB data

## Risks / things to know
- **Migrations may fail** if the zip's schema diverges from what's already in the DB. If a migration fails I'll patch it in-place (add `IF NOT EXISTS`, etc.) rather than dropping data. If a migration is fundamentally incompatible, I'll stop and ask before dropping anything.
- **Edge functions in the zip** will be deployed as-is; existing ones with the same name get overwritten. If any require new secrets, I'll list them and ask you to add them.
- **Netlify / Capacitor / Android workflow files** come along for the ride but Lovable itself deploys via its own pipeline — they're just there for future use.
- If `package.json` differs substantially, `bun install` may pull new deps; that's expected.

## Deliverable
A working preview at the current preview URL and a re-published site at `https://hug-it-and-ship-it.lovable.app`.

**Confirm to proceed** — this is a destructive replace of the current `src/`, `supabase/functions/`, `supabase/migrations/`, `package.json`, config files, etc.
