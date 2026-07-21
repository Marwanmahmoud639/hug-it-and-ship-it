import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "lv_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return "";
  }
}

async function currentContext() {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id ?? null;
    let team_id: string | null = null;
    if (uid) {
      const { data: p } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", uid)
        .maybeSingle();
      team_id = (p?.team_id as string | undefined) ?? null;
    }
    return { user_id: uid, team_id };
  } catch {
    return { user_id: null, team_id: null };
  }
}

export async function track(event: string, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const { user_id, team_id } = await currentContext();
    await supabase.from("analytics_events").insert({
      event,
      props,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      session_id: getSessionId(),
      user_id,
      team_id,
    });
  } catch (err) {
    // Swallow analytics errors — never break UX.
    if (import.meta.env.DEV) console.debug("[analytics] track failed", err);
  }
}

export function trackPageView(path?: string) {
  return track("page_view", { path: path ?? (typeof window !== "undefined" ? window.location.pathname : "") });
}
