import { createFileRoute } from "@tanstack/react-router";
import { validateTwilioSignature } from "@/lib/twilio.server";

// TwiML endpoint Twilio hits when the browser SDK initiates an outbound call.
// Returns <Response><Dial callerId="...">{to}</Dial></Response>.
export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerId = process.env.TWILIO_CALLER_ID;
        if (!callerId) return new Response("Caller ID not configured", { status: 500 });

        const url = new URL(request.url).toString();
        const formText = await request.text();
        const params: Record<string, string> = {};
        new URLSearchParams(formText).forEach((v, k) => { params[k] = v; });

        const signature = request.headers.get("x-twilio-signature");
        if (!signature || !validateTwilioSignature(url, params, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const to = (params.To || "").trim();
        if (!/^\+?[0-9\s\-()]{3,20}$/.test(to)) {
          return new Response("Invalid To", { status: 400 });
        }
        const safe = to.replace(/[<>&"']/g, "");
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}" answerOnBridge="true">${safe}</Dial></Response>`;
        return new Response(twiml, { status: 200, headers: { "Content-Type": "text/xml" } });
      },
    },
  },
});
