// Static US area code → IANA timezone map. Compact, comprehensive coverage of all
// active North American Numbering Plan codes used in the United States.
// Source: NANPA + FCC area code allocations as of 2026.

export type AreaCodeTimezone =
  | "America/New_York"     // ET
  | "America/Chicago"      // CT
  | "America/Denver"       // MT
  | "America/Phoenix"      // MST (no DST)
  | "America/Los_Angeles"  // PT
  | "America/Anchorage"    // AK
  | "Pacific/Honolulu"     // HI
  | "America/Puerto_Rico"; // AST

const ET = "America/New_York" as const;
const CT = "America/Chicago" as const;
const MT = "America/Denver" as const;
const MST = "America/Phoenix" as const;
const PT = "America/Los_Angeles" as const;
const AK = "America/Anchorage" as const;
const HI = "Pacific/Honolulu" as const;
const AST = "America/Puerto_Rico" as const;

export const AREA_CODE_TIMEZONE: Record<string, AreaCodeTimezone> = {
  // Eastern
  "201": ET, "202": ET, "203": ET, "207": ET, "212": ET, "215": ET, "216": ET,
  "217": CT, "219": ET, "220": ET, "223": ET, "224": CT, "227": ET, "229": ET,
  "231": ET, "234": ET, "239": ET, "240": ET, "243": ET, "248": ET, "251": CT,
  "252": ET, "253": PT, "254": CT, "256": CT, "260": ET, "262": CT, "267": ET,
  "269": ET, "270": CT, "272": ET, "274": CT, "276": ET, "281": CT, "283": ET,
  "301": ET, "302": ET, "303": MT, "304": ET, "305": ET, "307": MT, "308": CT,
  "309": CT, "310": PT, "312": CT, "313": ET, "314": CT, "315": ET, "316": CT,
  "317": ET, "318": CT, "319": CT, "320": CT, "321": ET, "323": PT, "325": CT,
  "330": ET, "331": CT, "332": ET, "334": CT, "336": ET, "337": CT, "339": ET,
  "346": CT, "347": ET, "351": ET, "352": ET, "360": PT, "361": CT, "364": CT,
  "365": ET, "380": ET, "385": MT, "386": ET, "401": ET, "402": CT, "404": ET,
  "405": CT, "406": MT, "407": ET, "408": PT, "409": CT, "410": ET, "412": ET,
  "413": ET, "414": CT, "415": PT, "417": CT, "419": ET, "423": ET, "424": PT,
  "425": PT, "430": CT, "432": CT, "434": ET, "435": MT, "440": ET, "442": PT,
  "443": ET, "445": ET, "447": CT, "458": PT, "463": ET, "464": CT, "469": CT,
  "470": ET, "475": ET, "478": ET, "479": CT, "480": MST, "484": ET, "501": CT,
  "502": ET, "503": PT, "504": CT, "505": MT, "507": CT, "508": ET, "509": PT,
  "510": PT, "512": CT, "513": ET, "515": CT, "516": ET, "517": ET, "518": ET,
  "520": MST, "530": PT, "531": CT, "534": CT, "539": CT, "540": ET, "541": PT,
  "551": ET, "557": CT, "559": PT, "561": ET, "562": PT, "563": CT, "564": PT,
  "567": ET, "570": ET, "571": ET, "573": CT, "574": ET, "575": MT, "580": CT,
  "585": ET, "586": ET, "601": CT, "602": MST, "603": ET, "605": CT, "606": ET,
  "607": ET, "608": CT, "609": ET, "610": ET, "612": CT, "614": ET, "615": CT,
  "616": ET, "617": ET, "618": CT, "619": PT, "620": CT, "623": MST, "626": PT,
  "628": PT, "629": CT, "630": CT, "631": ET, "636": CT, "640": ET, "641": CT,
  "646": ET, "650": PT, "651": CT, "657": PT, "660": CT, "661": PT, "662": CT,
  "667": ET, "669": PT, "678": ET, "679": ET, "680": ET, "681": ET, "682": CT,
  "689": ET, "701": CT, "702": PT, "703": ET, "704": ET, "706": ET, "707": PT,
  "708": CT, "712": CT, "713": CT, "714": PT, "715": CT, "716": ET, "717": ET,
  "718": ET, "719": MT, "720": MT, "724": ET, "725": PT, "727": ET, "730": CT,
  "731": CT, "732": ET, "734": ET, "737": CT, "740": ET, "743": ET, "747": PT,
  "754": ET, "757": ET, "760": PT, "762": ET, "763": CT, "765": ET, "770": ET,
  "772": ET, "773": CT, "774": ET, "775": PT, "779": CT, "781": ET, "785": CT,
  "786": ET, "801": MT, "802": ET, "803": ET, "804": ET, "805": PT, "806": CT,
  "808": HI, "810": ET, "812": ET, "813": ET, "814": ET, "815": CT, "816": CT,
  "817": CT, "818": PT, "820": PT, "828": ET, "830": CT, "831": PT, "832": CT,
  "835": ET, "838": ET, "839": ET, "843": ET, "845": ET, "847": CT, "848": ET,
  "850": CT, "856": ET, "857": ET, "858": PT, "859": ET, "860": ET, "862": ET,
  "863": ET, "864": ET, "865": ET, "870": CT, "872": CT, "878": ET, "901": CT,
  "903": CT, "904": ET, "906": ET, "907": AK, "908": ET, "909": PT, "910": ET,
  "912": ET, "913": CT, "914": ET, "915": MT, "916": PT, "917": ET, "918": CT,
  "919": ET, "920": CT, "925": PT, "928": MST, "929": ET, "930": ET, "931": CT,
  "934": ET, "936": CT, "937": ET, "938": CT, "940": CT, "941": ET, "947": ET,
  "949": PT, "951": PT, "952": CT, "954": ET, "956": CT, "959": ET, "970": MT,
  "971": PT, "972": CT, "973": ET, "975": CT, "978": ET, "979": CT, "980": ET,
  "984": ET, "985": CT, "989": ET,
  // Puerto Rico / Virgin Islands
  "787": AST, "939": AST, "340": AST,
};

const DIGITS_ONLY = /\D+/g;

/** Returns IANA timezone for a US phone number. */
export function timezoneFromPhone(phone: string): AreaCodeTimezone | null {
  if (!phone) return null;
  const digits = phone.replace(DIGITS_ONLY, "");
  // Strip country code 1
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length < 3) return null;
  return AREA_CODE_TIMEZONE[local.slice(0, 3)] ?? null;
}

const STATE_TZ: Record<string, AreaCodeTimezone> = {
  AL: CT, AK: AK, AZ: MST, AR: CT, CA: PT, CO: MT, CT: ET, DE: ET, FL: ET,
  GA: ET, HI: HI, ID: MT, IL: CT, IN: ET, IA: CT, KS: CT, KY: ET, LA: CT,
  ME: ET, MD: ET, MA: ET, MI: ET, MN: CT, MS: CT, MO: CT, MT: MT, NE: CT,
  NV: PT, NH: ET, NJ: ET, NM: MT, NY: ET, NC: ET, ND: CT, OH: ET, OK: CT,
  OR: PT, PA: ET, RI: ET, SC: ET, SD: CT, TN: CT, TX: CT, UT: MT, VT: ET,
  VA: ET, WA: PT, WV: ET, WI: CT, WY: MT, DC: ET, PR: AST, VI: AST,
};

export function timezoneFromState(state?: string | null): AreaCodeTimezone | null {
  if (!state) return null;
  const s = state.trim().toUpperCase();
  if (s.length === 2 && STATE_TZ[s]) return STATE_TZ[s];
  return null;
}
