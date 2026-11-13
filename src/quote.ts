export interface MinimumBand {
  /** Highest distance in this band, inclusive. The last band uses Infinity. */
  upToMiles: number;
  open: number;
  enclosed: number;
}

export interface PricingRules {
  /**
   * Open-trailer price follows a power curve, not a straight line: short hauls
   * cost a lot per mile because loading and dispatch are fixed costs, and the
   * rate falls steadily as the trip gets longer.
   *
   *   price = openBase × miles ^ openExponent
   *
   * The defaults reproduce published 2026 market medians within a few percent:
   * 300 mi ≈ $620, 1,250 mi ≈ $1,110, 2,750 mi ≈ $1,535.
   */
  openBase: number;
  openExponent: number;
  /** Enclosed transport runs about 70% above open on the same lane. */
  enclosedMultiplier: number;
  inopFee: number;
  noSteerFee: number;
  oversizeFee: number;
  depositPercent: number;
  minimums: MinimumBand[];
  /** Seasonal demand, applied on top of the curve. */
  seasonFactor: (miles: number, originState: string | null, destState: string | null, at?: Date) => number;
}

const SNOWBIRD_STATES = new Set(["FL", "AZ", "TX", "SC", "GA", "NV", "CA"]);

/** Snowbirds in winter, tax-season purchases at year end, moving season in summer. */
function defaultSeasonFactor(_miles: number, originState: string | null, destState: string | null, at = new Date()): number {
  const month = at.getUTCMonth() + 1;
  const day = at.getUTCDate();
  let factor = 1;

  const north = (state: string | null) => Boolean(state) && !SNOWBIRD_STATES.has(String(state).toUpperCase());
  const south = (state: string | null) => Boolean(state) && SNOWBIRD_STATES.has(String(state).toUpperCase());

  // November to March: the snowbird flow runs north to south
  if (month >= 11 || month <= 3) {
    if (north(originState) && south(destState)) factor += 0.08;
    else if (south(originState) && north(destState)) factor -= 0.03;
  }

  // mid-December to mid-January: people buy cars for the tax year
  if ((month === 12 && day >= 10) || (month === 1 && day <= 10)) factor += 0.05;

  // June to August: family moves
  if (month >= 6 && month <= 8) factor += 0.04;

  return Math.min(1.15, Math.max(0.95, factor));
}

export const DEFAULT_RULES: PricingRules = {
  openBase: 60.1,
  openExponent: 0.409,
  enclosedMultiplier: 1.7,
  inopFee: 150,
  noSteerFee: 250,
  oversizeFee: 200,
  depositPercent: 20,
  seasonFactor: defaultSeasonFactor,
  minimums: [
    { upToMiles: 25, open: 275, enclosed: 450 },
    { upToMiles: 75, open: 375, enclosed: 600 },
    { upToMiles: 150, open: 450, enclosed: 700 },
    { upToMiles: 300, open: 550, enclosed: 850 },
    { upToMiles: Number.POSITIVE_INFINITY, open: 600, enclosed: 950 },
  ],
};

export type TransportType = "open" | "enclosed";
export type VehicleCondition =
  | "running"
  | "inoperable_steer_roll"
  | "inoperable_no_steer"
  | "non-running";

export const CONDITION_LABELS: Record<VehicleCondition, string> = {
  running: "Run and drive",
  inoperable_steer_roll: "Inoperable (steer and roll)",
  inoperable_no_steer: "Inoperable (doesn't steer/roll/no keys)",
  "non-running": "Inoperable (steer and roll)",
};

export function parseCondition(value: string): VehicleCondition {
  if (value === "inoperable_no_steer") return "inoperable_no_steer";
  if (value === "inoperable_steer_roll" || value === "non-running") return "inoperable_steer_roll";
  return "running";
}

export function conditionLabel(value: string): string {
  return CONDITION_LABELS[value as VehicleCondition] ?? value;
}

export interface Place {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

interface ZippopotamPlace {
  "place name": string;
  "state abbreviation": string;
  latitude: string;
  longitude: string;
}

/** Look up a US ZIP through zippopotam.us; returns null when unknown or unreachable. */
export async function lookupZip(zip: string): Promise<Place | null> {
  const cleaned = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(cleaned)) return null;

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${cleaned}`, {
      signal: AbortSignal.timeout(3000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { places?: ZippopotamPlace[] };
    const place = payload.places?.[0];
    if (!place) return null;
    return {
      zip: cleaned,
      city: place["place name"],
      state: place["state abbreviation"],
      lat: Number(place.latitude),
      lng: Number(place.longitude),
    };
  } catch {
    return null;
  }
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: Place, b: Place): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/** Road distance runs longer than the straight line; 1.2 is the usual planning factor. */
export function roadMiles(a: Place, b: Place): number {
  return Math.round(haversineMiles(a, b) * 1.2);
}

export interface QuoteBreakdown {
  base: number;
  conditionFee: number;
  total: number;
  deposit: number;
  minimumApplied: boolean;
}

export function priceQuote(
  distanceMiles: number,
  transport: TransportType,
  condition: VehicleCondition,
  oversize: boolean,
  rules: PricingRules = DEFAULT_RULES,
  route: { originState?: string | null; destState?: string | null; at?: Date } = {},
): QuoteBreakdown {
  const band = rules.minimums.find((entry) => distanceMiles <= entry.upToMiles);
  const minimum = band ? (transport === "enclosed" ? band.enclosed : band.open) : 0;

  const curve = rules.openBase * Math.pow(Math.max(1, distanceMiles), rules.openExponent);
  const season = rules.seasonFactor(distanceMiles, route.originState ?? null, route.destState ?? null, route.at);
  const raw = curve * (transport === "enclosed" ? rules.enclosedMultiplier : 1) * season;
  const minimumApplied = raw < minimum;
  const base = Math.round(minimumApplied ? minimum : raw);
  const conditionFee =
    condition === "running" ? 0 : condition === "inoperable_no_steer" ? rules.noSteerFee : rules.inopFee;
  const sizeFee = oversize ? rules.oversizeFee : 0;
  const total = base + conditionFee + sizeFee;

  return {
    base,
    conditionFee: conditionFee + sizeFee,
    total,
    deposit: Math.round((total * rules.depositPercent) / 100),
    minimumApplied,
  };
}
