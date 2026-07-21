import type { DialerProvider } from "./provider";
import { ProviderNotImplementedError } from "./provider";

function stub(
  id: DialerProvider["id"],
  label: string,
  fields: DialerProvider["credentialFields"],
): DialerProvider {
  return {
    id,
    label,
    supportsVoice: true,
    supportsSms: true,
    credentialFields: fields,
    async sendSms() {
      throw new ProviderNotImplementedError(id);
    },
  };
}

export const bandwidthProvider = stub("bandwidth", "Bandwidth", [
  { key: "account_id", label: "Account ID", required: true },
  { key: "username", label: "Username", required: true },
  { key: "password", label: "Password", required: true, secret: true },
  { key: "application_id", label: "Messaging Application ID" },
]);

export const vonageProvider = stub("vonage", "Vonage", [
  { key: "api_key", label: "API Key", required: true },
  { key: "api_secret", label: "API Secret", required: true, secret: true },
]);

export const plivoProvider = stub("plivo", "Plivo", [
  { key: "auth_id", label: "Auth ID", required: true },
  { key: "auth_token", label: "Auth Token", required: true, secret: true },
]);

export const signalwireProvider = stub("signalwire", "SignalWire", [
  { key: "project_id", label: "Project ID", required: true },
  { key: "api_token", label: "API Token", required: true, secret: true },
  { key: "space_url", label: "Space URL", required: true, placeholder: "example.signalwire.com" },
]);

export const customSipProvider = stub("custom_sip", "Custom SIP / Other", [
  { key: "endpoint", label: "API Endpoint URL", required: true },
  { key: "username", label: "Username" },
  { key: "password", label: "Password / Token", secret: true },
]);
