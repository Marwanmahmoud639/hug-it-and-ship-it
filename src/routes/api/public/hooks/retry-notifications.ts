import { createFileRoute } from "@tanstack/react-router";
import { processRetryQueue } from "@/lib/notifications.server";

// Drains the notification retry queue. Auth-free because:
//  - it only processes rows already enqueued by our own dispatcher,
//  - rows that succeed/fail are removed/incremented atomically,
//  - work is idempotent and bounded to 100 rows per call.
// Called every 5 minutes by pg_cron, and on-demand from the settings UI.
export const Route = createFileRoute("/api/public/hooks/retry-notifications")({
  server: {
    handlers: {
      POST: async () => {
        const result = await processRetryQueue(100);
        return Response.json(result);
      },
    },
  },
});
