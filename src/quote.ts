export interface MinimumBand {
  /** Highest distance in this band, inclusive. The last band uses Infinity. */
  upToMiles: number;
  open: number;
  enclosed: number;
}

export interface PricingRules {
  openPerMile: number;
  enclosedPerMile: number;
  inopFee: number;
  noSteerFee: number;
  oversizeFee: number;
  depositPercent: number;
  minimums: MinimumBand[];
}

export const DEFAULT_RULES: PricingRules = {
  openPerMile: 0.95,
  enclosedPerMile: 1.35,
  inopFee: 150,
  noSteerFee: 250,
  oversizeFee: 200,
  depositPercent: 20,
  minimums: [
    { upToMiles: 25, open: 125, enclosed: 175 },
    { upToMiles: 75, open: 200, enclosed: 275 },
    { upToMiles: 150, open: 300, enclosed: 425 },
    { upToMiles: 300, open: 400, enclosed: 550 },
    { upToMiles: Number.POSITIVE_INFINITY, open: 450, enclosed: 650 },
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
): QuoteBreakdown {
  const perMile = transport === "enclosed" ? rules.enclosedPerMile : rules.openPerMile;
  const band = rules.minimums.find((entry) => distanceMiles <= entry.upToMiles);
  const minimum = band ? (transport === "enclosed" ? band.enclosed : band.open) : 0;

  const raw = distanceMiles * perMile;
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
