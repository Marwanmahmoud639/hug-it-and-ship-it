## Capacitor Integration Plan

Add Capacitor to wrap the existing TanStack Start web app as a native iOS/Android shell, without changing any existing functionality.

### 1. Install dependencies
- `bun add @capacitor/core @capacitor/app @capacitor/haptics @capacitor/keyboard @capacitor/status-bar`
- `bun add -d @capacitor/cli @capacitor/android @capacitor/ios`

### 2. `capacitor.config.ts` (project root)
```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.dialingfordollars.leads',
  appName: 'Dialing for Dollars',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For live-reload during dev (commented by default):
    // url: 'https://id-preview--cf04a8da-2943-49b6-b855-3864ef0edc8f.lovable.app',
    // cleartext: true,
  },
};

export default config;
```

### 3. Build output → `dist/`
TanStack Start's default build emits a server bundle, not a static `dist/` folder Capacitor can ship. To keep the web app fully working AND give Capacitor a static shell, add a thin SPA build path:
- Add a script `cap:build` that runs the existing Vite client build and outputs to `dist/` (using the existing `vite.netlify.config.ts` or a new `vite.capacitor.config.ts` with `build.outDir = 'dist'` and SPA fallback).
- All server functions (`createServerFn`) will still call the deployed web backend at `https://leads.dialingfordollars.co` — set `VITE_API_BASE` to that origin so the native shell talks to production APIs.

### 4. Add native platforms (documented commands; run locally)
```
npm run cap:build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios     # requires Xcode (macOS)
npx cap open android # requires Android Studio
```
Native projects (`ios/`, `android/`) are generated on the user's machine — not committed from the sandbox since they require Xcode/Android Studio to build.

### 5. `package.json` scripts
```
"cap:build": "vite build --config vite.capacitor.config.ts",
"cap:sync": "npm run cap:build && cap sync",
"cap:ios": "npm run cap:sync && cap open ios",
"cap:android": "npm run cap:sync && cap open android"
```

### 6. Out of scope (no changes)
- No edits to existing routes, auth, campaigns, email templates, or RLS.
- No PWA / service worker.
- Web deployment to `leads.dialingfordollars.co` is unchanged.

### Questions before I build
1. **App identifier** — confirm `co.dialingfordollars.leads` as `appId` (reverse-DNS, used in App Store / Play Store), or give me a different one?
2. **Native API origin** — should the native app point at the production domain `https://leads.dialingfordollars.co` for all server calls? (Required so Capacitor's static shell can reach your backend.)
3. **Deep links / push notifications / camera / geolocation** — do you want any native plugins now, or just the bare shell?
4. **Live reload in dev** — want the `server.url` line preconfigured to your preview URL for hot reload on device, or leave commented?
