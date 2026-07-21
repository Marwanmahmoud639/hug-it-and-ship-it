// Server-only Twilio JWT minting. Imported only by *.functions.ts files.
import jwt from "jsonwebtoken";

interface TokenInput {
  identity: string;
  ttlSeconds?: number;
}

/**
 * Mint a Twilio Voice Access Token compatible with @twilio/voice-sdk.
 * Implemented directly to avoid the Node-only `twilio` package.
 */
export function mintVoiceAccessToken({ identity, ttlSeconds = 3600 }: TokenInput): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    throw new Error("Twilio Voice secrets not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp: now + ttlSeconds,
    grants: {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: twimlAppSid },
      },
    },
  };
  return jwt.sign(payload, apiKeySecret, {
    header: { cty: "twilio-fpa;v=1", typ: "JWT", alg: "HS256" },
    algorithm: "HS256",
  });
}

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  // Twilio signature: HMAC-SHA1 of (url + sorted concatenated POST params), base64.
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map(k => k + params[k]).join("");
  // Use Web Crypto via Node crypto (works on Worker with nodejs_compat)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHmac, timingSafeEqual } = require("crypto") as typeof import("crypto");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
