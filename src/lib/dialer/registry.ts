import type { DialerProvider } from "./provider";
import { ProviderNotConfiguredError } from "./provider";
import { twilioProvider } from "./twilio";
import { telnyxProvider } from "./telnyx";
import {
  bandwidthProvider,
  vonageProvider,
  plivoProvider,
  signalwireProvider,
  customSipProvider,
} from "./stubs";

export const ALL_PROVIDERS: DialerProvider[] = [
  twilioProvider,
  telnyxProvider,
  bandwidthProvider,
  vonageProvider,
  plivoProvider,
  signalwireProvider,
  customSipProvider,
];

const BY_ID: Record<string, DialerProvider> = Object.fromEntries(
  ALL_PROVIDERS.map((p) => [p.id, p]),
);

export function getProvider(id: string): DialerProvider {
  const p = BY_ID[id];
  if (!p) throw new ProviderNotConfiguredError(id);
  return p;
}

export type TeamProviderRow = {
  provider: string;
  credentials: Record<string, string | undefined> | null;
  from_number: string | null;
  is_active: boolean;
};

export async function loadActiveProviderForTeam(
  teamId: string,
): Promise<{ adapter: DialerProvider; row: TeamProviderRow } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("team_dialer_providers")
    .select("provider, credentials, from_number, is_active")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { adapter: getProvider(data.provider), row: data as TeamProviderRow };
}
