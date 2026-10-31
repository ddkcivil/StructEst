import { MeasurementCategory, MeasurementItem, Project, SubDivisionLine } from '../../App';
import type { ComponentKind, DxfExtraction, ExtractedComponent } from './dxfTakeoff';
import { NBC_MEMBER_SIZES, estimateSteelKg, nbcWastageForUnit } from './nbc205';
import type { MinedDimension } from './pdfDimensionMiner';

/**
 * The standard 23-item BOQ schedule (Nepali "Purposed Estimate" format),
 * transcribed from the reference document "PARTIMA PURPOSED ESTIMATE 22.pdf"
 * (Civil Works, section B). This is the FIXED catalog the take-off quantities
 * aggregate into. The measurement-sheet (subdivision L×W×H lines) is the detail
 * layer that sums to each item's quantity — see SubDivisionLine in App.tsx.
 *
 * Units follow the source document: CuM, SqM, Kg, RM (running metre), Ls.
 */

export type StandardUnit = 'CuM' | 'SqM' | 'Kg' | 'RM' | 'Ls';

export interface StandardBoqItem {
  /** Item number in the standard schedule (1-23). */
  sn: number;
  /** Short title (as printed in the schedule). */
  title: string;
  /** Full specification text (the "काम/सेवाको विवरण" description). */
  description: string;
  /** Measurement unit as printed in the schedule. */
  unit: StandardUnit;
  /** App category this item belongs to. */
  category: MeasurementCategory;
  /** Component kinds from the take-off extractor that feed this item. */
  feedsFrom: ComponentKind[];
}

/** The 23 standard BOQ items. Order is significant — the BOQ renders in this order. */
export const STANDARD_BOQ_23: StandardBoqItem[] = [
  { sn: 1, title: 'Site Management & Site Clearance', description: 'Site management and site clearance before and after construction including cleaning, chemical surface treatment of existing column parts and building layout as per drawing, specification and instruction of the engineer, all complete.', unit: 'Ls', category: 'Site Prep', feedsFrom: [] },
  { sn: 2, title: 'Earth Work in Excavation', description: 'Earth work in excavation in foundation, floor, building periphery, septic/water tanks, compound wall etc. as per drawing, specification and instruction of the engineer, all complete.', unit: 'CuM', category: 'Earthwork', feedsFrom: [] },
  { sn: 3, title: 'Earth Work in Filling', description: 'Earth work in filling by borrowed/good excavated soil in foundation, floor, building periphery with proper ramming in 20 cm layers after sprinkling water and consolidating to 15 cm layers including transportation, spreading, compaction with mechanical rammers and testing, all complete.', unit: 'CuM', category: 'Earthwork', feedsFrom: [] },
  { sn: 4, title: 'Stone / Boulder Soling', description: 'Providing and laying 150 mm boulder/stone soling in foundation and floor with approved quality stone/boulder in required line and level including filling joints with sand, all complete.', unit: 'CuM', category: 'Substructure', feedsFrom: [] },
  { sn: 5, title: 'Plain Cement Concrete (P.C.C.) Work', description: 'Providing and laying plain cement concrete (1:2:4) in foundation and floor with cement, sand and coarse aggregate including mixing, laying in panels with proper slopes, lines and level, curing and formwork, all complete.', unit: 'CuM', category: 'Substructure', feedsFrom: [] },
  { sn: 6, title: 'P.C.C. for R.C.C (M20)', description: 'Providing and laying in position machine mixed and machine vibrated design mix cement concrete of specified grade (M20, 1:1.5:3) for reinforced cement concrete work using OPC cement with 20 mm graded machine crushed stone aggregate, including transportation, compaction, finishing to line and level, curing, excluding centring, shuttering and reinforcement, all complete.', unit: 'CuM', category: 'Superstructure', feedsFrom: ['column', 'beam', 'slab'] },
  { sn: 7, title: 'Steel Reinforcement (Fe 500)', description: 'Providing and fixing in position Fe 500 steel reinforcement of various diameter conforming to relevant IS code in R.C.C. works including straightening, cutting, bending, binding with 20 SWG annealed wire, spacers, chairs and cover blocks, all complete.', unit: 'Kg', category: 'Reinforcement', feedsFrom: ['column', 'beam', 'slab'] },
  { sn: 8, title: 'Formwork (Centering & Shuttering)', description: 'Supplying and laying centering, shuttering of various pattern formworks with water proof ply wood & steel adjustable props for all kinds of RCC works for foundations, columns, shear walls, beams, slab, staircase, lintel, sill, pergola, including nails, propping, scaffolding, staging and deshuttering, all complete.', unit: 'SqM', category: 'Formwork', feedsFrom: ['column', 'beam', 'slab'] },
  { sn: 9, title: 'Brick Work (1:4 CM)', description: 'Providing and laying brick work in 1:4 cement mortar in foundation and superstructure with approved quality first class brick in perfect line and level, including wetting bricks, packing joints, curing and necessary scaffolding, complete in all types and thickness of walls, associated cornices and columns.', unit: 'CuM', category: 'Superstructure', feedsFrom: ['wall'] },
  { sn: 10, title: 'Cement Sand Plaster (20 mm, 1:5)', description: 'Providing and laying cement sand plastering on floor, wall, ceiling, skirting, dado, cornices of good finish, including raking joints, cleaning and wetting the surface and curing, 20 mm thick in 1:5 mix, all complete.', unit: 'SqM', category: 'Finishing', feedsFrom: [] },
  { sn: 11, title: 'Distemper Painting (Double Coat)', description: 'Providing and applying inside painting work on wall and ceiling of approved colour including necessary primer to give uniform colour after rendering the surface clean and moist, all complete.', unit: 'SqM', category: 'Finishing', feedsFrom: [] },
  { sn: 12, title: 'M.S. Grill', description: 'Providing and laying M.S. grill of 10 mm × 10 mm solid square pipe of approved pattern and manufacture finished with one coat of red lead primer and two coats of enamel paint, all complete.', unit: 'SqM', category: 'Finishing', feedsFrom: ['window'] },
  { sn: 13, title: 'Sal Chaukhat', description: 'Providing and fixing original Nepali Sal wood door/window frame (chaukhat), all complete.', unit: 'CuM', category: 'Finishing', feedsFrom: ['door', 'window'] },
  { sn: 14, title: 'Ready Made Single Panel Door', description: 'Providing and fixing ready made single panel door with all accessories, 15 years warranty.', unit: 'SqM', category: 'Finishing', feedsFrom: ['door'] },
  { sn: 15, title: 'UPVC Windows / Louvre', description: 'Providing and fixing UPVC windows/louvre of prime company with fittings.', unit: 'SqM', category: 'Finishing', feedsFrom: ['window'] },
  { sn: 16, title: 'Electrical Works', description: 'Electrical works with all accessories as per NS standards — Rathi/Litmus wire with gang switches, NS standards.', unit: 'Ls', category: 'MEP Works', feedsFrom: [] },
  { sn: 17, title: 'Sanitary Works', description: 'Sanitary works — all equipment of NS standard companies, all complete.', unit: 'Ls', category: 'MEP Works', feedsFrom: ['toilet', 'fixture'] },
  { sn: 18, title: 'Granite Works', description: 'Providing and fixing granite works with all fittings.', unit: 'SqM', category: 'Finishing', feedsFrom: [] },
  { sn: 19, title: 'Ceramic Vitrified Tiles', description: 'Providing and laying ceramic vitrified tiles (Rockland Indian) with all fittings.', unit: 'SqM', category: 'Finishing', feedsFrom: [] },
  { sn: 20, title: 'Staircase Railing (SS 202)', description: 'Supplying, fitting and fixing stainless steel 202 grade hand railing (3\'-0" height) using 50 mm dia 1.5 mm thick pipe with designed balustrade and bracing, grinding, buffing, polishing, all complete.', unit: 'RM', category: 'Civil Works', feedsFrom: [] },
  { sn: 21, title: 'Metal Gate', description: 'Providing and fixing metal gate as per 3D/design, all complete.', unit: 'Ls', category: 'Civil Works', feedsFrom: [] },
  { sn: 22, title: 'Grills / Wood Door Paints', description: 'Painting of grills and wood doors, all complete.', unit: 'Ls', category: 'Finishing', feedsFrom: [] },
  { sn: 23, title: 'Compound Wall Railing', description: 'Providing and fixing compound wall railing with all fittings.', unit: 'Ls', category: 'Civil Works', feedsFrom: [] }
];

/**
 * Map the schedule's printed unit to the app's internal quantity unit.
 * CuM → m³, SqM → m², RM → m, Kg stays kg, Ls → pcs (count/lump sum).
 */
export const standardUnitToAppUnit = (u: StandardUnit): MeasurementItem['unit'] => {
  switch (u) {
    case 'CuM': return 'm³';
    case 'SqM': return 'm²';
    case 'RM': return 'm';
    case 'Kg': return 'kg';
    case 'Ls': return 'pcs';
    default: return 'pcs';
  }
};

/** Look up a standard item by its schedule number. */
export const standardItemBySn = (sn: number): StandardBoqItem | undefined =>
  STANDARD_BOQ_23.find(i => i.sn === sn);

/**
 * All standard BOQ items a take-off component kind feeds into. A kind can map to
 * several items (e.g. 'slab' → concrete SN6, steel SN7, formwork SN8); callers
 * resolve which aspect (concrete/steel/formwork) each line represents.
 */
export const standardItemsForKind = (kind: ComponentKind): StandardBoqItem[] =>
  STANDARD_BOQ_23.filter(i => i.feedsFrom.includes(kind));

// ---- Take-off extraction → standard 23-item BOQ ----------------------------

export interface BuildStandardBoqOptions {
  height?: number;         // m, default project.standardWallHeight
  wallThickness?: number;  // m, default 0.23
  slabThickness?: number;  // m, default NBC_MEMBER_SIZES.slab.thickness
  /** Override auto-resolved rates by keyword (e.g. /brick|masonr/ → 16000). */
  resolveRate?: (re: RegExp) => number | undefined;
  fileName?: string;
}

const stdNewId = () => `std-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const lineId = () => `sl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100;

/** Typical clear opening areas used for wall deductions (m²). */
const STD_DOOR_AREA = 0.9 * 2.1;    // 1.89 m²
const STD_WINDOW_AREA = 1.2 * 1.2;  // 1.44 m²

/** Per measurement-sheet line quantity for a given unit (mirrors App.tsx math). */
export const subdivisionLineQty = (unit: MeasurementItem['unit'], line: SubDivisionLine): number => {
  if (unit === 'm³') return r2(line.qty * line.length * line.width * line.height);
  if (unit === 'm²') return r2(line.qty * line.length * line.width);
  if (unit === 'rft' || unit === 'm') return r2(line.qty * line.length);
  return r2(line.qty);
};

/**
 * Convert a DXF/PDF extraction into the STANDARD 23-item BOQ, where each item
 * carries its take-off detail as measurement-sheet subdivision lines (L×W×H).
 *
 * This is the "extracted data → measurement sheet first → 23-item BOQ" flow:
 * every quantity becomes a SubDivisionLine under the correct standard item, and
 * the item's summary qty is the sum of those lines. Only items that actually
 * receive quantity are emitted, so the schedule stays at most 23 rows and never
 * invents categories.
 *
 * Component → item mapping (see StandardBoqItem.feedsFrom):
 *   wall    → SN9 brick masonry (m³)
 *   column  → SN6 RCC concrete (m³) + SN7 steel (kg)
 *   beam    → SN6 (m³) + SN7 (kg)
 *   slab    → SN6 (m³) + SN7 (kg)
 *   door    → SN14 door (pcs)
 *   window  → SN15 UPVC window (pcs)
 *   toilet  → SN17 sanitary (pcs); fixture → SN17 (pcs)
 */
export const buildStandardBoqFromExtraction = (
  extraction: DxfExtraction,
  project: Project,
  options: BuildStandardBoqOptions = {}
): MeasurementItem[] => {
  const height = options.height ?? project.standardWallHeight;
  const wallT = options.wallThickness ?? 0.23;
  const slabT = options.slabThickness ?? NBC_MEMBER_SIZES.slab.thickness;
  const rate = options.resolveRate || (() => undefined);
  const fname = options.fileName ? ` (${options.fileName})` : '';

  // Accumulate per-standard-item subdivision lines.
  const itemsBySn = new Map<number, { spec: StandardBoqItem; lines: SubDivisionLine[] }>();
  const addLine = (sn: number, line: Omit<SubDivisionLine, 'id'>) => {
    let entry = itemsBySn.get(sn);
    if (!entry) {
      const spec = standardItemBySn(sn);
      if (!spec) return;
      entry = { spec, lines: [] };
      itemsBySn.set(sn, entry);
    }
    entry.lines.push({ ...line, id: lineId() });
  };

  const byKind = (k: ComponentKind) => extraction.components.find(c => c.kind === k);

  const wall = byKind('wall');
  const door = byKind('door');
  const window = byKind('window');
  if (wall && wall.lengthM > 0) {
    addLine(9, { description: `Brickwork — ${wall.lengthM} m run × ${wallT} m × ${height} m${fname}`, qty: 1, length: wall.lengthM, width: wallT, height });
    // Deduct the drawn openings as a NEGATIVE measurement-sheet line (the PDF
    // standard shows deductions as negative sub-lines). Line math for CuM:
    // −1 × openArea × wallT, i.e. the same gross-minus-openings net volume the
    // old deductionsArea path produced.
    const openArea = (door?.count || 0) * STD_DOOR_AREA + (window?.count || 0) * STD_WINDOW_AREA;
    if (openArea > 0) {
      addLine(9, { description: `Less: door/window openings — ${openArea.toFixed(2)} m² × ${wallT} m${fname}`, qty: -1, length: r2(openArea), width: wallT, height: 1 });
    }
  }

  // RCC members → concrete (SN6), and accumulate volume for steel (SN7).
  const concreteVol: Record<string, number> = {};
  const addConcrete = (sn: number, desc: string, l: number, w: number, h: number, memberType: string) => {
    addLine(sn, { description: desc, qty: 1, length: l, width: w, height: h });
    concreteVol[memberType] = (concreteVol[memberType] || 0) + l * w * h;
  };

  const column = byKind('column');
  if (column && column.areaM2 > 0) {
    addConcrete(6, `RCC column — ${column.count} nos × ${column.areaM2.toFixed(2)} m² footprint × ${height} m${fname}`, column.areaM2, 1, height, 'column');
  }

  const beam = byKind('beam');
  if (beam && beam.lengthM > 0) {
    addConcrete(6, `RCC beam — ${beam.lengthM} m × ${wallT} m × ${height} m${fname}`, beam.lengthM, wallT, height, 'beam');
  }

  const slab = byKind('slab');
  if (slab && slab.areaM2 > 0) {
    addConcrete(6, `RCC slab — ${slab.areaM2} m² × ${slabT} m${fname}`, slab.areaM2, slabT, 1, 'slab');
  }

  // Steel (SN7) derived from concrete volume by member type.
  for (const [memberType, vol] of Object.entries(concreteVol)) {
    const kg = estimateSteelKg(vol, memberType);
    if (kg > 0) addLine(7, { description: `Fe 500 reinforcement — ${memberType}, ${vol.toFixed(2)} m³ concrete${fname}`, qty: kg, length: 1, width: 1, height: 1 });
  }

  // Doors / windows / fixtures — counted as pcs (measurement-sheet Nos line).
  if (door && door.count > 0) addLine(14, { description: `Single panel door — ${door.count} nos${fname}`, qty: door.count, length: 1, width: 1, height: 1 });
  if (window && window.count > 0) addLine(15, { description: `UPVC window — ${window.count} nos${fname}`, qty: window.count, length: 1, width: 1, height: 1 });
  const toilet = byKind('toilet');
  const fixture = byKind('fixture');
  const sanCount = (toilet?.count || 0) + (fixture?.count || 0);
  if (sanCount > 0) addLine(17, { description: `Sanitary fitting (WC/basin/sink) — ${sanCount} nos${fname}`, qty: sanCount, length: 1, width: 1, height: 1 });

  // Build MeasurementItems in schedule order.
  const items: MeasurementItem[] = [];
  for (const [sn, entry] of Array.from(itemsBySn.entries()).sort((a, b) => a[0] - b[0])) {
    const { spec, lines } = entry;
    const appUnit = standardUnitToAppUnit(spec.unit);
    const qty = Math.max(0, r2(lines.reduce((s, l) => s + subdivisionLineQty(appUnit, l), 0)));
    const rateRe =
      spec.sn === 9 ? /brick|masonr/i :
      spec.sn === 6 ? /concrete|rcc/i :
      spec.sn === 7 ? /steel|rebar|reinforc|tmt/i :
      spec.sn === 8 ? /formwork|shutter|centering/i :
      spec.sn === 14 ? /door/i :
      spec.sn === 15 ? /window|glaz|upvc|alumin/i :
      spec.sn === 17 ? /wc|toilet|sink|basin|sanitar/i : /.*/i;
    items.push({
      id: stdNewId(),
      category: spec.category,
      description: `${spec.sn}. ${spec.title}${fname}`,
      unit: appUnit,
      length: 1, width: 1, height: 1,
      qty,
      wastagePercent: nbcWastageForUnit(appUnit, spec.title),
      unitRate: rate(rateRe) ?? 0,
      subDivisions: lines
    });
  }

  return items;
};
export interface MinedBoqOptions {
  height?: number;
  wallThickness?: number;
  slabThickness?: number;
  resolveRate?: (re: RegExp) => number | undefined;
  fileName?: string;
  footingCounts?: Record<string, number>;
}

/**
 * Convert mined PDF text dimensions (pdfDimensionMiner) into the STANDARD
 * 23-item BOQ with measurement-sheet subdivision lines — the same shape
 * buildStandardBoqFromExtraction produces, so downstream push/merge/sync is
 * identical.
 *
 * Mapping:
 *   footing (LxWxD + count) → SN2 excavation, SN4 soling, SN5 PCC, SN6 RCC
 *   column section          → SN6 concrete (needs height) + SN7 steel
 *   beam section            → SN6 + SN7 (needs run length — caller supplies via
 *                             footingCounts-adjacent lengths or defaults 0/skip)
 *   slab thickness + rooms  → SN6 (room area × thickness) + SN7
 *   opening (LxW × count)   → SN14/15/V/CG + negative SN9 deduction lines
 *   room                    → SN9 brickwork shell note (area only, no height
 *                             assumption — caller may re-run with height)
 */
export const buildStandardBoqFromMinedDims = (
  dims: MinedDimension[],
  project: Project,
  options: MinedBoqOptions = {}
): MeasurementItem[] => {
  const height = options.height ?? project.standardWallHeight;
  const wallT = options.wallThickness ?? 0.23;
  const slabT = options.slabThickness ?? NBC_MEMBER_SIZES.slab.thickness;
  const rate = options.resolveRate || (() => undefined);
  const fname = options.fileName ? ` (${options.fileName})` : '';
  const counts = options.footingCounts ?? {};

  const itemsBySn = new Map<number, { spec: StandardBoqItem; lines: SubDivisionLine[] }>();
  const addLine = (sn: number, line: Omit<SubDivisionLine, 'id'>) => {
    let entry = itemsBySn.get(sn);
    if (!entry) {
      const spec = standardItemBySn(sn);
      if (!spec) return;
      entry = { spec, lines: [] };
      itemsBySn.set(sn, entry);
    }
    entry.lines.push({ ...line, id: lineId() });
  };
  const concreteVol: Record<string, number> = {};
  const addConcrete = (desc: string, l: number, w: number, h: number, memberType: string) => {
    addLine(6, { description: desc, qty: 1, length: l, width: w, height: h });
    concreteVol[memberType] = (concreteVol[memberType] || 0) + l * w * h;
  };

  const footings = dims.filter((d) => d.family === 'footing');
  for (const f of footings) {
    const n = counts[f.label] ?? f.count ?? 1;
    const exD = 1.5; // excavation depth per general notes (min 1500 mm)
    addLine(2, { description: `Excavation — ${f.label} ${n} nos × ${f.lengthM} × ${f.widthM} × ${exD}${fname}`, qty: n, length: f.lengthM, width: f.widthM, height: exD });
    addLine(4, { description: `Soling — ${f.label} ${n} nos × ${f.lengthM} × ${f.widthM} × 0.15${fname}`, qty: n, length: f.lengthM, width: f.widthM, height: 0.15 });
    addLine(5, { description: `PCC 75mm — ${f.label} ${n} nos × ${f.lengthM} × ${f.widthM} × 0.075${fname}`, qty: n, length: f.lengthM, width: f.widthM, height: 0.075 });
    addConcrete(`RCC footing ${f.label} — ${n} nos × ${f.lengthM} × ${f.widthM} × ${f.depthM || 0.35}${fname}`, n * f.lengthM * f.widthM, f.depthM || 0.35, 1, 'footing');
  }

  const slabDims = dims.filter((d) => d.family === 'slab');
  const rooms = dims.filter((d) => d.family === 'room');
  const slabThk = slabDims.length > 0 ? Math.max(...slabDims.map((d) => d.depthM)) : slabT;
  // De-dupe rooms by label (ground + first floor repeat some names): keep max area per label.
  const roomsByLabel = new Map<string, MinedDimension>();
  for (const r of rooms) {
    const prev = roomsByLabel.get(r.label);
    if (!prev || r.lengthM * r.widthM > prev.lengthM * prev.widthM) roomsByLabel.set(r.label, r);
  }
  for (const r of roomsByLabel.values()) {
    const area = r2(r.lengthM * r.widthM);
    addConcrete(`RCC slab — ${r.label} ${area} m² × ${slabThk} m${fname}`, area, slabThk, 1, 'slab');
  }

  const columns = dims.filter((d) => d.family === 'column');
  for (const c of columns) {
    const area = r2(c.lengthM * c.widthM);
    addConcrete(`RCC column ${c.label} — ${area} m² × ${height} m${fname}`, area, 1, height, 'column');
  }

  for (const [memberType, vol] of Object.entries(concreteVol)) {
    const kg = estimateSteelKg(vol, memberType);
    if (kg > 0) addLine(7, { description: `Fe 500 reinforcement — ${memberType}, ${vol.toFixed(2)} m³ concrete${fname}`, qty: kg, length: 1, width: 1, height: 1 });
  }

  const openings = dims.filter((d) => d.family === 'opening');
  // De-dupe openings by code (schedule repeats across pages): keep first per code.
  const seen = new Set<string>();
  let deductArea = 0;
  for (const o of openings) {
    if (seen.has(o.label)) continue;
    seen.add(o.label);
    const area = r2(o.lengthM * o.widthM);
    deductArea += area * o.count;
    const sn = /^D/.test(o.label) ? 14 : /^(W|V)/.test(o.label) ? 15 : 21;
    addLine(sn, { description: `${o.label} — ${area} m² × ${o.count} nos${fname}`, qty: o.count, length: o.lengthM, width: o.widthM, height: 1 });
  }
  if (deductArea > 0) {
    addLine(9, { description: `Less: door/window openings — ${deductArea.toFixed(2)} m² × ${wallT} m${fname}`, qty: -1, length: r2(deductArea), width: wallT, height: 1 });
  }

  const items: MeasurementItem[] = [];
  for (const [sn, entry] of Array.from(itemsBySn.entries()).sort((a, b) => a[0] - b[0])) {
    const { spec, lines } = entry;
    const appUnit = standardUnitToAppUnit(spec.unit);
    const qty = Math.max(0, r2(lines.reduce((s, l) => s + subdivisionLineQty(appUnit, l), 0)));
    items.push({
      id: stdNewId(),
      category: spec.category,
      description: `${spec.sn}. ${spec.title}${fname}`,
      unit: appUnit,
      length: 1, width: 1, height: 1,
      qty,
      wastagePercent: nbcWastageForUnit(appUnit, spec.title),
      unitRate: rate(/.*/) ?? 0,
      subDivisions: lines
    });
  }
  return items;
};



// ---- Canvas measurement → standard item mapping ---------------------------

/**
 * Heuristic mapping from a manually-drawn canvas measurement to the standard
 * BOQ item (S.N.) it should feed. A canvas measurement carries no component
 * "kind" (unlike DXF), so we infer from the category the user assigned plus the
 * geometry (unit + shape):
 *
 *   Superstructure + linear wall run (m³/m)      → SN9  brick masonry
 *   Superstructure + area/volume (slab/column)   → SN6  RCC concrete
 *   Substructure (PCC/soling)                     → SN5  plain cement concrete
 *   Earthwork (m³)                                → SN2  excavation
 *   Formwork (m²)                                 → SN8  formwork
 *   Reinforcement (kg)                            → SN7  steel
 *   Finishing (m²)                                → SN10 plaster (default)
 *   MEP Works                                     → SN17 sanitary (default)
 *   Site Prep                                     → SN1  site clearance
 *   Civil Works                                   → SN23 compound railing (default)
 *
 * This is a best-effort default; the user can always switch the canvas to
 * "existing item" mode to attach a measurement to a specific standard row, or
 * edit the target in the schedule.
 */
export const standardSnForMeasurement = (m: {
  category: string;
  unit: 'm³' | 'm²' | 'm' | 'rft' | 'pcs' | 'kg' | 'bags' | 'tons';
  type?: 'line' | 'polygon' | 'rectangle';
}): number => {
  const cat = m.category;
  const isLinear = m.type === 'line';

  switch (cat) {
    case 'Site Prep':
      return 1;
    case 'Earthwork':
      return 2;
    case 'Substructure':
      return 5;
    case 'Superstructure':
      // Linear wall run → brick masonry; area/volume → RCC concrete.
      return isLinear && (m.unit === 'm' || m.unit === 'rft' || m.unit === 'm³') ? 9 : 6;
    case 'Formwork':
      return 8;
    case 'Reinforcement':
      return 7;
    case 'Finishing':
      return 10; // plaster by default
    case 'MEP Works':
      return 17; // sanitary by default
    case 'Civil Works':
      return 23;
    default:
      return 6;
  }
};


// ---- Standard 23-item schedule view ---------------------------------------

export interface StandardScheduleRow {
  sn: number;
  title: string;
  description: string;
  unit: StandardUnit;
  category: MeasurementCategory;
  /** The project item matched to this standard row, if any. */
  item: MeasurementItem | null;
  /** Quantity from the matched item (0 when none). */
  qty: number;
  /** Unit rate from the matched item (0 when none). */
  rate: number;
  /** Amount = qty × rate (0 when none). */
  amount: number;
  /** True when this standard row has a real measured item behind it. */
  measured: boolean;
}

const standardSnFromDescription = (desc: string): number | null => {
  const m = desc.match(/^\s*(\d{1,2})\./);
  return m ? parseInt(m[1], 10) : null;
};

/** Public: extract the leading "N. " schedule number from an item description. */
export const snFromDescription = standardSnFromDescription;

/**
 * Rewrite an item so that calculateItemQuantity() returns exactly `finalQty`
 * (the value a user typed into the standard schedule). Wastage is reversed so
 * the displayed quantity matches the entry, and dimension units store the whole
 * quantity as a single summary line (length = qty, W=H=nos=1) — the same
 * "summary dimensions" convention the app already uses for non-detailed items.
 */
export const withSummaryQuantity = (item: MeasurementItem, finalQty: number): MeasurementItem => {
  const w = 1 + (item.wastagePercent || 0) / 100;
  const raw = w > 0 ? finalQty / w : finalQty;
  const countLike = item.unit === 'pcs' || item.unit === 'kg' || (item.unit as string) === 'bags' || (item.unit as string) === 'tons';
  if (countLike) {
    return { ...item, qty: Number(raw.toFixed(4)), deductionsArea: undefined };
  }
  // m / m² / m³ → store whole quantity in length (summary line).
  return { ...item, length: Number(raw.toFixed(4)), width: 1, height: 1, qty: 1, deductionsArea: undefined };
};

/**
 * Build the standard 23-item BOQ schedule for display: one row per standard
 * item (always all 23, in schedule order), each matched to the project item
 * that was extracted/added under the same S.N. Un-measured items show qty 0
 * and are flagged `measured: false` so the UI can grey them out.
 *
 * `qtyFor`/`rateFor` are injected so this stays pure and independent of the
 * app's internal calculateItemQuantity/calculateItemTotalCost.
 */
export const buildStandardBoqSchedule = (
  items: MeasurementItem[],
  opts: {
    qtyFor: (item: MeasurementItem) => number;
    rateFor: (item: MeasurementItem) => number;
  }
): StandardScheduleRow[] => {
  return STANDARD_BOQ_23.map(spec => {
    const item = items.find(i => snFromDescription(i.description || '') === spec.sn) || null;
    const qty = item ? opts.qtyFor(item) : 0;
    const rate = item ? opts.rateFor(item) : 0;
    return {
      sn: spec.sn,
      title: spec.title,
      description: spec.description,
      unit: spec.unit,
      category: spec.category,
      item,
      qty,
      rate,
      amount: Number((qty * rate).toFixed(2)),
      measured: !!item && qty > 0
    };
  });
};



