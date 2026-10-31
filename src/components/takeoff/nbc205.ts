import { MeasurementCategory } from '../../App';

/**
 * NBC 205:2024 — "Ready-to-Use Detailing Guideline for Low Rise Reinforced
 * Concrete Buildings without Masonry Infill" (Nepal).
 *
 * This module centralises the code's prescriptive values so the estimator uses
 * standards-compliant defaults and can compute reinforcement steel mass (kg),
 * which the app previously never derived. All values are transcribed from the
 * guideline (verified against the published PDF). Where a value is an estimator
 * convention rather than a code mandate it is marked as such.
 *
 * Source: NBC 205:2024, approved under Building Act 2055.
 */

// ---- Materials (§5.1 Concrete, §5.3 Reinforcing Steel) -------------------

export const NBC_CONCRETE = {
  grade: 'M20',
  mix: '1:1.5:3',
  /** Characteristic compressive strength, 28-day cube (N/mm²). */
  fck: 20
} as const;

export const NBC_STEEL = {
  grade: 'Fe 500',
  /** Characteristic yield strength (N/mm²). */
  fy: 500,
  /** Fe 415 permitted only for sill/lintel bands (§5.3). */
  alternateGrade: 'Fe 415'
} as const;

// ---- Recommended member sizes (§7.4) -------------------------------------

export const NBC_MEMBER_SIZES = {
  footing: { thickness: [0.35, 0.40], rebar: '12Ø & 16Ø (Fe 500)' },
  strapBeam: { width: 0.40, depth: 0.45, rebar: '16Ø (Fe 500)' },
  column: { width: [0.35, 0.40], depth: [0.35, 0.40] },
  plinthBeam: { width: 0.25, depth: 0.355 },
  floorBeam: {
    firstFloor: { width: [0.25, 0.30], depth: [0.355, 0.38] },
    upperFloor: { width: 0.25, depth: 0.355 }
  },
  slab: { thickness: 0.125 },        // 125 mm (5") roof & floors
  staircaseWaist: { thickness: 0.15 } // 150 mm (6")
} as const;

// ---- Clear cover to reinforcement (mm) -----------------------------------

export const NBC_COVER = {
  column: 40,   // to stirrups
  beam: 25,     // to stirrups
  slab: 20,     // to rebar
  footingSide: 75,
  footingBottom: 50
} as const;

// ---- Rebar development length (Table 9-10) -------------------------------

/** For Fe 500 in M20 concrete, development length Ld = 57 × bar diameter (mm). */
export const nbcDevelopmentLength = (barDiameterMm: number): number => 57 * barDiameterMm;

/** Closed tie hook: 135° hook, min extension max(6Ø, 65 mm). */
export const nbcHookLength = (barDiameterMm: number): number => Math.max(6 * barDiameterMm, 65);

// ---- Rebar unit mass (kg/m) ----------------------------------------------

/**
 * Mass per metre of a round bar: m = ρ · (π d² / 4), ρ = 7850 kg/m³, d in m.
 * Standard TMT unit weights (rounded to the values used on site).
 */
export const REBAR_UNIT_WEIGHT: Record<number, number> = {
  6: 0.222,
  8: 0.395,
  10: 0.617,
  12: 0.888,
  16: 1.578,
  20: 2.466,
  25: 3.854,
  32: 6.313
};

export const rebarWeightPerMeter = (diameterMm: number): number => {
  const d = diameterMm / 1000; // m
  return 7850 * Math.PI * d * d * 0.25;
};

// ---- Reinforcement estimation ratios -------------------------------------

/**
 * Typical RCC steel content (kg of rebar per m³ of concrete) for Nepali low-rise
 * residential construction. These are widely-used estimator rules of thumb, NOT
 * NBC mandates — the code prescribes detailing (bar size/spacing), not a kg/m³
 * ratio. Provided so the app can produce a Reinforcement (kg) BOQ line from a
 * concrete volume.
 */
export const STEEL_RATIO_KG_PER_M3: Record<string, number> = {
  slab: 80,
  beam: 110,
  column: 130,
  wall: 90,
  footing: 90,
  staircase: 120,
  lintel: 60
};

/** Default steel ratio when the member type is unknown. */
export const DEFAULT_STEEL_RATIO = 100;

export const estimateSteelKg = (concreteVolumeM3: number, memberType: keyof typeof STEEL_RATIO_KG_PER_M3 | string): number => {
  const ratio = STEEL_RATIO_KG_PER_M3[memberType] ?? DEFAULT_STEEL_RATIO;
  return Number((concreteVolumeM3 * ratio).toFixed(2));
};

// ---- Wastage allowances (estimator convention) ---------------------------

/** Standard wastage factors. Steel 5%, brick 5%, concrete 3%. */
export const NBC_WASTAGE = {
  steel: 5,
  brick: 5,
  concrete: 3,
  plaster: 5,
  default: 5
} as const;

export const nbcWastageForUnit = (unit: string, description = ''): number => {
  const d = description.toLowerCase();
  if (unit === 'kg' || /steel|rebar|reinforc|tmt/i.test(d)) return NBC_WASTAGE.steel;
  if (unit === 'pcs' || /brick|block|masonr/i.test(d)) return NBC_WASTAGE.brick;
  if (unit === 'm³' || /concrete|rcc|pcc/i.test(d)) return NBC_WASTAGE.concrete;
  return NBC_WASTAGE.default;
};

// ---- Reference summary for the UI ----------------------------------------

export interface NbcReferenceRow {
  member: string;
  size: string;
  concrete: string;
  steel: string;
  cover: string;
}

/** A compact standards table the estimator can consult in-app. */
export const NBC_REFERENCE_TABLE: NbcReferenceRow[] = [
  { member: 'Isolated Footing', size: '350 / 400 mm thick', concrete: 'M20', steel: '12Ø & 16Ø (Fe 500)', cover: '50 mm bottom / 75 mm side' },
  { member: 'Strap / Plinth Beam', size: '250 × 355 mm (strap 400 × 450)', concrete: 'M20', steel: 'Fe 500 TMT', cover: '25 mm' },
  { member: 'Column', size: '350 × 350 / 400 × 400 mm', concrete: 'M20', steel: 'Fe 500 TMT (8Ø stirrups)', cover: '40 mm' },
  { member: 'Floor Beam', size: '250 × 355 mm', concrete: 'M20', steel: 'Fe 500 TMT (3-12Ø TH)', cover: '25 mm' },
  { member: 'Slab (roof/floor)', size: '125 mm (5")', concrete: 'M20', steel: '8Ø @ 150 c/c (Fe 500)', cover: '20 mm' },
  { member: 'Staircase Waist', size: '150 mm (6")', concrete: 'M20', steel: '12Ø main / 8Ø distribution', cover: '25 mm' }
];

/** Rebar development length table (Fe 500 / M20), for the detailing reference. */
export const NBC_DEVELOPMENT_LENGTHS: { diameter: number; Ld: number }[] = [8, 10, 12, 16, 20, 25].map(d => ({
  diameter: d,
  Ld: nbcDevelopmentLength(d)
}));
