/**
 * Vehicle catalogue, bundled.
 *
 * The app used to ask the NHTSA vPIC API on every cold cache. When that service
 * is down (it answers 503 for hours at a time) the make and model pickers went
 * blank, which is what happened here. These lists are the floor: the remote
 * catalogue can add to them, but it can never empty them.
 */

export const FALLBACK_MAKES_CAR: string[] = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Bugatti", "Buick",
  "Cadillac", "Chevrolet", "Chrysler", "Daewoo", "Dodge", "Eagle", "Ferrari", "FIAT",
  "Fisker", "Ford", "Genesis", "Geo", "GMC", "Honda", "Hummer", "Hyundai", "INFINITI",
  "Isuzu", "Jaguar", "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus", "Lincoln",
  "Lotus", "Lucid", "Maserati", "Maybach", "Mazda", "McLaren", "Mercedes-Benz", "Mercury",
  "MINI", "Mitsubishi", "Nissan", "Oldsmobile", "Plymouth", "Polestar", "Pontiac",
  "Porsche", "Ram", "Rivian", "Rolls-Royce", "Saab", "Saturn", "Scion", "Smart",
  "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo",
];

export const FALLBACK_MAKES_MOTORCYCLE: string[] = [
  "Aprilia", "BMW", "Can-Am", "Ducati", "Harley-Davidson", "Honda", "Husqvarna",
  "Indian", "Kawasaki", "KTM", "Moto Guzzi", "Norton", "Polaris", "Royal Enfield",
  "Suzuki", "Triumph", "Ural", "Vespa", "Victory", "Yamaha", "Zero",
];

/** The models people actually ship. Anything else can still be typed by hand. */
export const FALLBACK_MODELS: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Stelvio", "Tonale", "4C", "Giulietta"],
  "Aston Martin": ["DB11", "Vantage", "DBX", "DBS", "Rapide", "Vanquish"],
  "Bentley": ["Continental GT", "Bentayga", "Flying Spur", "Mulsanne"],
  "Bugatti": ["Chiron", "Veyron"],
  "Daewoo": ["Lanos", "Nubira", "Leganza"],
  "Eagle": ["Talon", "Summit", "Vision"],
  "Fisker": ["Karma", "Ocean"],
  "Geo": ["Metro", "Prizm", "Tracker", "Storm"],
  "Hummer": ["H1", "H2", "H3"],
  "Isuzu": ["Rodeo", "Trooper", "Ascender", "Hombre", "Amigo"],
  "Lamborghini": ["Huracan", "Aventador", "Urus", "Gallardo", "Murcielago"],
  "Lotus": ["Elise", "Exige", "Evora", "Emira"],
  "Lucid": ["Air", "Gravity"],
  "Maybach": ["S-Class", "GLS"],
  "McLaren": ["570S", "720S", "GT", "Artura", "765LT"],
  "Mercury": ["Sable", "Mountaineer", "Grand Marquis", "Milan", "Mariner"],
  "Oldsmobile": ["Cutlass", "Alero", "Intrigue", "Bravada", "Silhouette"],
  "Plymouth": ["Neon", "Voyager", "Prowler", "Breeze"],
  "Pontiac": ["Grand Am", "Grand Prix", "Firebird", "GTO", "Vibe", "Montana", "Aztek", "Bonneville"],
  "Rolls-Royce": ["Phantom", "Ghost", "Cullinan", "Wraith", "Dawn"],
  "Saab": ["9-3", "9-5", "900", "9000"],
  "Saturn": ["SL", "SC", "Ion", "Vue", "Outlook", "Aura"],
  "Scion": ["tC", "xB", "xD", "FR-S", "iQ"],
  "Smart": ["Fortwo"],
  "Suzuki": ["Swift", "Vitara", "SX4", "Kizashi", "Grand Vitara"],
  Acura: ["MDX", "RDX", "TLX", "Integra", "ILX", "RLX", "ZDX", "TSX", "TL", "NSX"],
  Audi: ["A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron", "RS5", "S4", "TT"],
  BMW: ["3 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X7", "M3", "M5", "i3", "i4", "iX", "Z4", "4 Series"],
  Buick: ["Enclave", "Encore", "Encore GX", "Envision", "LaCrosse", "Regal", "Verano"],
  Cadillac: ["Escalade", "XT4", "XT5", "XT6", "CT4", "CT5", "Lyriq", "SRX", "ATS"],
  Chevrolet: ["Silverado", "Equinox", "Malibu", "Traverse", "Tahoe", "Suburban", "Colorado", "Camaro", "Corvette", "Blazer", "Trax", "Bolt", "Impala", "Cruze", "Express"],
  Chrysler: ["300", "Pacifica", "Town & Country", "Sebring", "200"],
  Dodge: ["Charger", "Challenger", "Durango", "Grand Caravan", "Journey", "Ram 1500", "Dart"],
  Ferrari: ["488", "F8", "Roma", "Portofino", "SF90", "812", "California", "GTC4Lusso"],
  FIAT: ["500", "500X", "500L", "124 Spider"],
  Ford: ["F-150", "F-250", "F-350", "Mustang", "Explorer", "Escape", "Edge", "Ranger", "Bronco", "Expedition", "Fusion", "Focus", "Fiesta", "Taurus", "Maverick", "Transit", "E-Transit", "Explorer Sport Trac"],
  Genesis: ["G70", "G80", "G90", "GV70", "GV80", "GV60"],
  GMC: ["Sierra", "Yukon", "Acadia", "Terrain", "Canyon", "Savana", "Hummer EV"],
  Honda: ["Accord", "Civic", "CR-V", "Pilot", "Odyssey", "HR-V", "Passport", "Ridgeline", "Element", "Fit", "Insight", "S2000", "Prologue"],
  Hyundai: ["Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Ioniq 5", "Ioniq 6", "Accent", "Veloster", "Venue", "Santa Cruz"],
  INFINITI: ["Q50", "Q60", "QX50", "QX55", "QX60", "QX80", "G37", "FX35"],
  Jaguar: ["F-Pace", "E-Pace", "I-Pace", "XF", "XJ", "F-Type", "XE"],
  Jeep: ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Renegade", "Gladiator", "Wagoneer", "Grand Wagoneer", "Patriot"],
  Kia: ["Sportage", "Sorento", "Telluride", "Forte", "K5", "Soul", "Seltos", "Carnival", "Niro", "EV6", "Stinger", "Rio"],
  "Land Rover": ["Range Rover", "Range Rover Sport", "Range Rover Evoque", "Discovery", "Defender", "Discovery Sport", "LR4"],
  Lexus: ["RX", "NX", "GX", "LX", "ES", "IS", "LS", "UX", "RC", "LC"],
  Lincoln: ["Navigator", "Aviator", "Corsair", "Nautilus", "Continental", "MKZ", "MKX"],
  Maserati: ["Ghibli", "Levante", "Quattroporte", "Grecale", "GranTurismo"],
  Mazda: ["CX-5", "CX-9", "CX-30", "CX-50", "CX-90", "Mazda3", "Mazda6", "MX-5 Miata", "MX-30"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLC", "GLE", "GLS", "G-Class", "A-Class", "CLA", "GLA", "GLB", "Sprinter", "Metris", "EQS", "EQE"],
  MINI: ["Cooper", "Countryman", "Clubman", "Paceman", "Convertible"],
  Mitsubishi: ["Outlander", "Outlander Sport", "Eclipse Cross", "Mirage", "Lancer", "Endeavor", "Montero"],
  Nissan: ["Altima", "Sentra", "Rogue", "Murano", "Pathfinder", "Frontier", "Titan", "Armada", "Versa", "Kicks", "Maxima", "370Z", "Ariya", "NV200"],
  Polestar: ["Polestar 2", "Polestar 3", "Polestar 4"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera", "Taycan", "Boxster", "Cayman", "718"],
  Ram: ["1500", "2500", "3500", "ProMaster", "ProMaster City", "Dakota"],
  Rivian: ["R1T", "R1S"],
  Subaru: ["Outback", "Forester", "Crosstrek", "Impreza", "Ascent", "WRX", "Legacy", "BRZ", "Baja", "Solterra"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck", "Roadster"],
  Toyota: ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "Tundra", "4Runner", "Sienna", "Prius", "Avalon", "Sequoia", "Land Cruiser", "C-HR", "Supra", "bZ4X", "Grand Highlander", "Crown"],
  Volkswagen: ["Jetta", "Passat", "Tiguan", "Atlas", "Atlas Cross Sport", "Golf", "GTI", "ID.4", "Taos", "Arteon", "Beetle", "Touareg"],
  Volvo: ["XC90", "XC60", "XC40", "S60", "S90", "V60", "V90", "C40", "EX30", "EX90"],
  Aprilia: ["RSV4", "Tuono", "RS 660", "Dorsoduro", "Shiver"],
  "Can-Am": ["Spyder", "Ryker", "Maverick", "Outlander", "Commander"],
  Husqvarna: ["Vitpilen", "Svartpilen", "TE 300", "FE 350", "Norden 901"],
  "Moto Guzzi": ["V7", "V85 TT", "California", "Griso"],
  Norton: ["Commando", "Dominator", "V4"],
  Polaris: ["Slingshot", "RZR", "Sportsman", "Ranger", "Indian"],
  "Royal Enfield": ["Classic 350", "Meteor 350", "Himalayan", "Interceptor 650", "Continental GT"],
  Ural: ["Gear Up", "CT", "cT"],
  Vespa: ["Primavera", "Sprint", "GTS", "Elettrica"],
  Victory: ["Vegas", "Cross Country", "Hammer", "Vision"],
  Zero: ["SR", "SR/F", "DSR", "FX", "S"],
  "Harley-Davidson": ["Street Glide", "Road Glide", "Fat Boy", "Sportster", "Softail", "Road King", "Heritage Classic", "Pan America", "Nightster"],
  Kawasaki: ["Ninja", "Z900", "Versys", "Concours", "Vulcan", "KLR", "KLX"],
  Yamaha: ["YZF-R1", "YZF-R6", "MT-07", "MT-09", "FZ-09", "V-Star", "Bolt", "Tenere", "TMAX"],
  Ducati: ["Panigale", "Monster", "Multistrada", "Diavel", "Scrambler", "Streetfighter"],
  Triumph: ["Bonneville", "Speed Triple", "Street Triple", "Tiger", "Rocket 3", "Scrambler"],
  KTM: ["Duke", "RC", "Adventure", "Supermoto", "EXC"],
  Indian: ["Chief", "Chieftain", "Roadmaster", "Scout", "FTR", "Springfield"],
};

export function fallbackMakes(type: "car" | "motorcycle"): string[] {
  return type === "motorcycle" ? FALLBACK_MAKES_MOTORCYCLE : FALLBACK_MAKES_CAR;
}

export function fallbackModels(make: string): string[] {
  const key = Object.keys(FALLBACK_MODELS).find((name) => name.toLowerCase() === make.trim().toLowerCase());
  return key ? FALLBACK_MODELS[key]! : [];
}
