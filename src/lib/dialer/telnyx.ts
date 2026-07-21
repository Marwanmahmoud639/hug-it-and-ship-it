import type { DialerProvider } from "./provider";

export const telnyxProvider: DialerProvider = {
  id: "telnyx",
  label: "Telnyx",
  supportsVoice: true,
  supportsSms: true,
  credentialFields: [
    { key: "api_key", label: "API Key", required: true, secret: true, placeholder: "KEY..." },
    { key: "messaging_profile_id", label: "Messaging Profile ID" },
  ],

  async sendSms(creds, fromNumber, { to, body }) {
    const apiKey = creds.api_key;
    if (!apiKey) throw new Error("Telnyx: missing api_key");
    const payload: any = { from: fromNumber, to, text: body };
    if (creds.messaging_profile_id) payload.messaging_profile_id = creds.messaging_profile_id;
    const r = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(j?.errors?.[0]?.detail || `Telnyx error ${r.status}`);
    return { providerMessageId: j?.data?.id ?? null, status: "queued", raw: j };
  },

  async parseInboundSms(_creds, _request, rawBody) {
    const j = JSON.parse(rawBody);
    const payload = j?.data?.payload ?? {};
    return {
      from: payload?.from?.phone_number ?? "",
      to: payload?.to?.[0]?.phone_number ?? "",
      body: payload?.text ?? "",
      providerMessageId: payload?.id ?? null,
    };
  },
};
