// Pluggable dialer/SMS provider abstraction.
// Each adapter implements this interface; the registry picks the active one per team.

export type SmsSendInput = {
  to: string;
  from: string;
  body: string;
};

export type SmsSendResult = {
  providerMessageId: string | null;
  status: string;
  raw?: unknown;
};

export type InboundSms = {
  from: string;
  to: string;
  body: string;
  providerMessageId: string | null;
};

export type ProviderCredentials = Record<string, string | undefined>;

export interface DialerProvider {
  readonly id:
    | "twilio"
    | "telnyx"
    | "bandwidth"
    | "vonage"
    | "plivo"
    | "signalwire"
    | "custom_sip";
  readonly label: string;
  readonly supportsVoice: boolean;
  readonly supportsSms: boolean;
  /** Field definitions for the settings UI. */
  readonly credentialFields: Array<{
    key: string;
    label: string;
    secret?: boolean;
    placeholder?: string;
    required?: boolean;
  }>;
  sendSms(
    creds: ProviderCredentials,
    fromNumber: string,
    input: { to: string; body: string },
  ): Promise<SmsSendResult>;
  /** Parse an inbound webhook body into a normalized event. Throw on invalid signature. */
  parseInboundSms?(
    creds: ProviderCredentials,
    request: Request,
    rawBody: string,
  ): Promise<InboundSms>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Dialer provider "${provider}" is not configured for this team`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: string) {
    super(
      `Dialer provider "${provider}" is not yet implemented. Choose Twilio or Telnyx for now.`,
    );
    this.name = "ProviderNotImplementedError";
  }
}
