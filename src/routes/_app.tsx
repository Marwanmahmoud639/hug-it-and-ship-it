import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Navbar } from "@/components/app-shell/navbar";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { CallingProvider } from "@/components/calling/calling-provider";
import { DialerFab } from "@/components/calling/dialer-fab";
import { LeadDrawerProvider } from "@/components/contacts/lead-drawer-provider";
import { LeadDrawer } from "@/components/contacts/lead-drawer";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const { session, loading, role, isSuperAdmin, team } = useAuth();
  const pathname = useRouterState({ select: s => s.location.pathname });
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" />;

  // Force new signups through onboarding before seeing the app. Skip for super-admins.
  if (!isSuperAdmin && team && !(team as any).onboarding_completed_at) {
    return <Navigate to="/onboarding" />;
  }


  // Super-admin-only routes (platform-level surfaces). Blocked for every other account.
  const superOnlyBlocked = ["/super-admin", "/agency"];
  if (!isSuperAdmin && superOnlyBlocked.some(p => pathname.startsWith(p))) {
    return <Navigate to="/dashboard" />;
  }

  const agentBlocked = ["/discovery", "/analytics", "/team", "/campaigns", "/settings", "/workflows", "/proposals", "/monitors", "/portals"];
  const managerBlocked = ["/team"];
  if (role === "agent" && agentBlocked.some(p => pathname.startsWith(p))) {
    return <Navigate to="/dashboard" />;
  }
  if (role === "manager" && managerBlocked.some(p => pathname.startsWith(p))) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <CallingProvider>
      <LeadDrawerProvider>
        <div className="flex h-screen w-full bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Navbar />
            <main className="flex-1 overflow-auto pb-16 md:pb-0"><Outlet /></main>
          </div>
          <BottomNav />
          <DialerFab />
          <LeadDrawer />
          <AssistantBubble />
        </div>
      </LeadDrawerProvider>
    </CallingProvider>
  );
}
