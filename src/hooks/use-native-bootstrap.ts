// Registers push token with backend + wires notification handling on native builds.
// Mounted once from the root layout; safe no-op on web.
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { initPushNotifications, isNative, getDeviceInfo } from "@/lib/native";

export function useNativeBootstrap() {
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const device = await getDeviceInfo().catch(() => null);

      await initPushNotifications(
        async (token, platform) => {
          await supabase.from("device_tokens").upsert(
            {
              user_id: user.id,
              token,
              platform,
              device_id: device?.identifier ?? null,
              device_model: device?.model ?? null,
              os_version: device?.osVersion ?? null,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "token" },
          );
        },
        (notif) => {
          const title = notif?.title ?? notif?.data?.title ?? "New notification";
          const body = notif?.body ?? notif?.data?.body ?? "";
          toast(title, { description: body });
        },
      );
    })();

    return () => { cancelled = true; };
  }, []);
}
