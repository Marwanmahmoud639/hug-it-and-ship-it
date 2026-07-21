// Shared secret guard for internal /api/public/hooks/* cron endpoints.
// pg_cron (and any external scheduler) must send `X-Cron-Secret: <CRON_SECRET>`.
// Returns null if authorized, otherwise a Response to return immediately.

export function requireCronSecret(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET not configured", { status: 503 });
  }
  const provided = request.headers.get("x-cron-secret") ?? "";
  // Constant-time-ish comparison
  if (provided.length !== expected.length) {
    return new Response("Unauthorized", { status: 401 });
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
