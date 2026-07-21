import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, HeadContent, Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand";
import { SubdomainBrandBoot } from "@/components/SubdomainBrandBoot";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go home</a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: BRAND.pageTitle },
      { name: "description", content: `${BRAND.long} — internal command center.` },
      { name: "robots", content: "noindex, nofollow" },
      { title: "Reach For Dollars" },
      { property: "og:title", content: "Reach For Dollars" },
      { name: "twitter:title", content: "Reach For Dollars" },
      { name: "description", content: "C4D (Command, Control, Convert, Dominate) is an all-in-one lead generation and CRM platform built for real estate wholesalers, cash buyers, flippers, agents, a" },
      { property: "og:description", content: "C4D (Command, Control, Convert, Dominate) is an all-in-one lead generation and CRM platform built for real estate wholesalers, cash buyers, flippers, agents, a" },
      { name: "twitter:description", content: "C4D (Command, Control, Convert, Dominate) is an all-in-one lead generation and CRM platform built for real estate wholesalers, cash buyers, flippers, agents, a" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/P2p6NJLvpgW5bqQxZtfSbczZw4y1/social-images/social-1779803944651-Stylized_Arrow_with_Integrated_Hand_and_Dollar_Sign.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/P2p6NJLvpgW5bqQxZtfSbczZw4y1/social-images/social-1779803944651-Stylized_Arrow_with_Integrated_Hand_and_Dollar_Sign.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SubdomainBrandBoot />
          <AnalyticsTracker />
          <Outlet />
          <Toaster richColors position="bottom-right" closeButton />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
