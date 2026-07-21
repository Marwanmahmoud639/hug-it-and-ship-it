# Dialing for Dollars — Launchpad

TanStack Start app with Twilio dialer/SMS, Lovable Cloud (Supabase) auth + DB,
and Lovable AI Gateway. Built and previewed inside Lovable; can also be
self-deployed to Netlify.

---

## Deploying to Netlify

The project ships with two build targets:

- `npm run build` — default Cloudflare Workers build (used by Lovable's hosted preview/publish).
- `npm run build:netlify` — Netlify build (uses `vite.netlify.config.ts`). Outputs static assets to `dist/client/` and the SSR bundle to `dist/server/server.js`, which `netlify/functions/server.mjs` wraps into a Netlify Function.

`netlify.toml` wires it together: it runs the Netlify build, publishes `dist/client`, and redirects every request that doesn't match a static asset to the SSR function (which handles routes, server functions, and `/api/public/*` server routes).

### 1. Push the repo to GitHub

Export the project from Lovable (or `git clone` the connected repo) and push to a GitHub repository you control.

### 2. Create a Netlify site

1. Netlify → **Add new site → Import an existing project** → pick the GitHub repo.
2. Build command and publish directory are read from `netlify.toml` automatically.
3. Deploy. The first deploy will fail until env vars are set (next step).

### 3. Set environment variables

Netlify → **Site settings → Environment variables**. Add each of the following. Values for `SUPABASE_*` come from your Lovable Cloud project; values for `TWILIO_*` come from your Twilio console.

**Lovable Cloud (Supabase) — required**

| Name | Notes |
|---|---|
| `VITE_SUPABASE_URL` | e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key |
| `VITE_SUPABASE_PROJECT_ID` | Project ref |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | Same as `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, **never** prefix with `VITE_` |

**Lovable AI Gateway (if you use AI features)**

| Name | Notes |
|---|---|
| `LOVABLE_API_KEY` | Get from Lovable workspace settings |

**Twilio (Voice + SMS)**

| Name |
|---|
| `TWILIO_ACCOUNT_SID` |
| `TWILIO_AUTH_TOKEN` |
| `TWILIO_API_KEY` |
| `TWILIO_API_SECRET` |
| `TWILIO_TWIML_APP_SID` |
| `TWILIO_PHONE_NUMBER` |

**Webhook / cron**

| Name | Notes |
|---|---|
| `CRON_SECRET` | Shared secret for cron-triggered endpoints |

**Other data-provider keys (only if used by your flows)**

`APIFY_API_KEY`, `APOLLO_API_KEY`, `BREVO_API_KEY`, `CLAY_API_KEY`,
`FIRECRAWL_API_KEY`, `LUSHA_API_KEY`, `SEAMLESS_API_KEY`, `SERPER_API_KEY`,
`TRESTLE_API_KEY`.

Redeploy after saving env vars.

### 4. Move `leads.dialingfordollars.co` to Netlify

1. Netlify → **Domain management → Add a domain** → enter `leads.dialingfordollars.co`. Netlify will show a target hostname (e.g. `<site>.netlify.app`) or a load-balancer IP.
2. At your DNS provider (the registrar managing `dialingfordollars.co`):
   - Delete the existing `leads` **A** record pointing to `185.158.133.1` (Lovable).
   - Add a **CNAME** for `leads` pointing to the hostname Netlify provided (preferred), or an **A** record pointing to Netlify's load-balancer IP.
3. Wait for DNS to propagate. Netlify will auto-provision a Let's Encrypt SSL cert.
4. In Netlify, mark `leads.dialingfordollars.co` as the **Primary domain**.

After cutover, the Lovable "Publish" button no longer affects what's live at this domain.

### 5. Reconfigure Twilio webhooks

In the Twilio console, repoint anything that was hitting the Lovable URL to your new host:

- **Voice TwiML App** → Voice Request URL → `https://leads.dialingfordollars.co/api/public/twilio/voice`
- **Messaging Service** → Inbound webhook → `https://leads.dialingfordollars.co/api/public/twilio/sms-inbound`
- **Status callbacks** → match the URLs above

(Adjust paths to match the routes under `src/routes/api/public/twilio/`.)

### 6. Verify

- `https://leads.dialingfordollars.co/` loads the app.
- Sign in works (Supabase reachable).
- Open the dialer, make a test call, send a test SMS.
- Send a Twilio inbound SMS and confirm it lands in the app.

---

## Local development

```bash
npm install
npm run dev
```

The `.env` file is auto-managed by Lovable Cloud locally. For a Netlify-only
clone, copy the env-var list above into a `.env` at the project root before
running `npm run dev`.
