/**
 * Real-estate data adapters (ATTOM, PropStream, BatchLeads).
 * All providers stubbed with deterministic mocks until API keys land.
 */

export type RealEstateLookup = {
  isInvestor: boolean;
  propertiesOwned: number;
  recentTransactions12mo: number;
  llcRegisteredAgent: string | null;
  llcMailingAddress: string | null;
  portfolioSize: "small" | "medium" | "large" | "unknown";
  activeBuyerSignal: boolean;
  lastTransactionDate: string | null; // ISO date
  source: "attom" | "propstream" | "batchleads" | "mock";
  isMock: boolean;
};

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function mockLookup(company: string, source: RealEstateLookup["source"]): RealEstateLookup {
  const h = hash(company || "x");
  const properties = (h % 35) + 1;
  const recent = h % 6;
  const portfolio = properties >= 20 ? "large" : properties >= 5 ? "medium" : "small";
  const active = recent > 0 && (h % 4 === 0);
  const lastTx = active ? new Date(Date.now() - (h % 90) * 86400_000).toISOString().slice(0, 10) : null;
  return {
    isInvestor: true,
    propertiesOwned: properties,
    recentTransactions12mo: recent,
    llcRegisteredAgent: `${["J. Smith", "M. Johnson", "R. Davis", "A. Garcia"][h % 4]}`,
    llcMailingAddress: `${1000 + (h % 8999)} Main St, ${["Austin TX", "Houston TX", "Miami FL", "Atlanta GA"][h % 4]}`,
    portfolioSize: portfolio,
    activeBuyerSignal: active,
    lastTransactionDate: lastTx,
    source,
    isMock: true,
  };
}

export async function lookupAttom(company: string, key: string | null | undefined): Promise<RealEstateLookup> {
  return mockLookup(company, key ? "attom" : "mock");
}
export async function lookupPropStream(company: string, key: string | null | undefined): Promise<RealEstateLookup> {
  return mockLookup(company, key ? "propstream" : "mock");
}
export async function lookupBatchLeads(company: string, key: string | null | undefined): Promise<RealEstateLookup> {
  return mockLookup(company, key ? "batchleads" : "mock");
}
