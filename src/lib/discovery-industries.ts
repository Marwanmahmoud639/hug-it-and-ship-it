// Industry presets for the Discovery search. The `value` is stored as
// `searches.industry_filter` and mirrored (case-insensitively) in the
// discovery-run edge function to filter merged results.
export type IndustryOption = {
  value: string;
  label: string;
  // Human-readable hint of what will match — for the UI only.
  hint?: string;
};

export const DISCOVERY_INDUSTRIES: IndustryOption[] = [
  { value: "real_estate", label: "Real Estate / Cash Buyers", hint: "wholesalers, investors, cash buyers, property, realtor" },
  { value: "roofing", label: "Roofing", hint: "roofers, roofing contractors" },
  { value: "hvac", label: "HVAC", hint: "heating, cooling, air conditioning" },
  { value: "plumbing", label: "Plumbing", hint: "plumbers, drainage, water heater" },
  { value: "electrical", label: "Electrical", hint: "electricians, electric contractors" },
  { value: "landscaping", label: "Landscaping / Lawn Care", hint: "lawn, landscaping, tree service" },
  { value: "cleaning", label: "Cleaning Services", hint: "janitorial, house cleaning, maid" },
  { value: "pest_control", label: "Pest Control", hint: "exterminator, pest" },
  { value: "construction", label: "Construction / Contractors", hint: "general contractor, builder, remodeling" },
  { value: "legal", label: "Legal / Law Firms", hint: "attorney, lawyer, law firm" },
  { value: "accounting", label: "Accounting / Tax", hint: "cpa, accountant, bookkeeping, tax" },
  { value: "insurance", label: "Insurance", hint: "insurance agent, broker" },
  { value: "medical", label: "Medical / Dental", hint: "dentist, clinic, medical practice" },
  { value: "automotive", label: "Automotive", hint: "auto repair, mechanic, body shop" },
  { value: "restaurant", label: "Restaurants / Food", hint: "restaurant, cafe, catering" },
  { value: "retail", label: "Retail / Shops", hint: "store, shop, boutique" },
  { value: "fitness", label: "Fitness / Gyms", hint: "gym, fitness studio, personal trainer" },
  { value: "marketing", label: "Marketing / Agencies", hint: "digital marketing, seo, advertising" },
  { value: "it_services", label: "IT / Tech Services", hint: "it services, msp, computer repair" },
];
