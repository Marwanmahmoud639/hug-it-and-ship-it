import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wraps the deployed web app as a native iOS/Android shell.
// Because this is a TanStack Start SSR app, the native shell loads the
// production web URL directly instead of bundling a static build.
const config: CapacitorConfig = {
  appId: "co.dialingfordollars.leads",
  appName: "Dialing for Dollars",
  webDir: "dist",
  server: {
    url: "https://leads.dialingfordollars.co",
    androidScheme: "https",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
