import type { DialerProvider, ProviderCredentials } from "./provider";

export const twilioProvider: DialerProvider = {
  id: "twilio",
  label: "Twilio",
  supportsVoice: true,
  supportsSms: true,
  credentialFields: [
    { key: "account_sid", label: "Account SID", required: true, placeholder: "ACxxxxxxxxxxxx" },
    { key: "auth_token", label: "Auth Token", required: true, secret: true },
  ],

  async sendSms(creds, fromNumber, { to, body }) {
    const sid = creds.account_sid;
    const token = creds.auth_token;
    if (!sid || !token) throw new Error("Twilio: missing account_sid/auth_token");
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const form = new URLSearchParams({ To: to, From: fromNumber, Body: body });
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const j: any = await r.json();
    if (!r.ok) throw new Error(j?.message || `Twilio error ${r.status}`);
    return { providerMessageId: j.sid ?? null, status: j.status ?? "queued", raw: j };
  },

  async parseInboundSms(_creds: ProviderCredentials, _request: Request, rawBody: string) {
    const params = new URLSearchParams(rawBody);
    return {
      from: params.get("From") ?? "",
      to: params.get("To") ?? "",
      body: params.get("Body") ?? "",
      providerMessageId: params.get("MessageSid"),
    };
  },
};
