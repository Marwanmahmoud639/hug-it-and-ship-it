import { createFileRoute } from "@tanstack/react-router";
import { validateTwilioSignature } from "@/lib/twilio.server";

// Twilio fetches this when an AI call is answered. It returns TwiML that opens
// a bidirectional media stream to the ai-call-bridge edge function, which is
// where the OpenAI Realtime conversation actually happens.
//
// <Connect><Stream> is deliberate: unlike <Start><Stream>, it blocks the call
// leg for the stream's lifetime, so the call stays up while the AI talks and
// ends when the bridge closes.
export const Route = createFileRoute("/api/public/twilio/ai-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session");
        if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
          return new Response("Invalid session", { status: 400 });
        }

        const formText = await request.text();
        const params: Record<string, string> = {};
        new URLSearchParams(formText).forEach((v, k) => { params[k] = v; });

        const signature = request.headers.get("x-twilio-signature");
        if (!signature || !validateTwilioSignature(url.toString(), params, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        // Answering machine detected — hang up rather than pitch a voicemail.
        // Leaving a prerecorded AI voicemail is a separate regulatory question
        // from a live AI conversation, so it is not done implicitly here.
        const answeredBy = params.AnsweredBy ?? "";
        if (answeredBy.startsWith("machine") || answeredBy === "fax") {
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
            { status: 200, headers: { "Content-Type": "text/xml" } },
          );
        }

        const projectRef = process.env.SUPABASE_PROJECT_REF;
        if (!projectRef) return new Response("Bridge not configured", { status: 500 });
        const bridgeUrl =
          `wss://${projectRef}.functions.supabase.co/ai-call-bridge?session=${encodeURIComponent(sessionId)}`;

        const twiml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<Response><Connect><Stream url="${bridgeUrl}"/></Connect></Response>`;
        return new Response(twiml, { status: 200, headers: { "Content-Type": "text/xml" } });
      },
    },
  },
});
