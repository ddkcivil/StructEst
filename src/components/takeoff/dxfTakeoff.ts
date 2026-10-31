import { MeasurementCategory } from '../../App';

/**
 * DXF component extraction (walls, columns, beams, slabs, doors, windows, WCs).
 *
 * Reality check (verified against a real residential DXF):
 *  - Drawing units are frequently INCHES/FEET, not meters. We read $INSUNITS
 *    from the header and convert to meters before measuring. Assuming meters
 *    yields lengths ~39x too large.
 *  - Drafters often leave most geometry on the default layer "0", so a pure
 *    layer scheme is unreliable. We extract by BOTH layer keywords AND block
 *    symbols (INSERT), which is where doors/windows/fixtures actually live.
 *  - TEXT/MTEXT tags (W1..W5, D1.., room names) supplement counting.
 */

// ---- Drawing units -------------------------------------------------------

export type DxfUnit = 'unknown' | 'inches' | 'feet' | 'millimeters' | 'centimeters' | 'meters' | 'miles';

const INSUNITS_TO_UNIT: Record<number, DxfUnit> = {
  0: 'unknown',
  1: 'inches',
  2: 'feet',
  4: 'millimeters',
  5: 'centimeters',
  6: 'meters',
  11: 'miles'
};

/** Meters per one drawing unit. */
const UNIT_TO_METERS: Record<DxfUnit, number> = {
  unknown: 1,
  inches: 0.0254,
  feet: 0.3048,
  millimeters: 0.001,
  centimeters: 0.01,
  meters: 1,
  miles: 1609.344
};

export const detectDxfUnit = (dxf: any): DxfUnit => {
  const raw = dxf && dxf.header ? dxf.header['$INSUNITS'] : undefined;
  if (typeof raw === 'number' && INSUNITS_TO_UNIT[raw]) return INSUNITS_TO_UNIT[raw];
  return 'unknown';
};

export const unitToMeters = (unit: DxfUnit): number => UNIT_TO_METERS[unit] || 1;

// ---- Geometry helpers ----------------------------------------------------

type Pt = { x: number; y: number };

const segLen = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

const fmtNum = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** Polyline length in meters. */
export const polylineLengthMeters = (pts: Pt[], scale: number, closed = false): number => {
  if (!pts || pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += segLen(pts[i], pts[i + 1]);
  if (closed && pts.length > 2) total += segLen(pts[pts.length - 1], pts[0]);
  return total * scale;
};

/** Polygon area (shoelace) in m². */
export const polygonAreaMeters = (pts: Pt[], scale: number): number => {
  if (!pts || pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return (Math.abs(a) / 2) * scale * scale;
};

/** Tessellate an ARC (dxf-parser gives radians, always CCW from start → end). */
export const arcPoints = (center: Pt, radius: number, startAngle: number, endAngle: number): Pt[] => {
  if (!(radius > 0)) return [];
  let sweep = endAngle - startAngle;
  while (sweep <= 1e-9) sweep += Math.PI * 2; // wrap (e.g. 350° → 10°)
  const segs = Math.max(4, Math.ceil(sweep / (Math.PI / 16)));
  const pts: Pt[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = startAngle + (sweep * i) / segs;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
};

/**
 * Points along the arc from a → b defined by a polyline bulge
 * (bulge = tan(includedAngle / 4), positive = counterclockwise). Returns the
 * tessellated arc with `b` as the final element, or just [b] when bulge = 0.
 */
export const bulgePoints = (a: Pt, b: Pt, bulge: number): Pt[] => {
  if (!bulge) return [{ x: b.x, y: b.y }];
  const theta = 4 * Math.atan(bulge); // signed included angle
  const dx = b.x - a.x, dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  const sinHalf = Math.sin(theta / 2);
  if (chord === 0 || sinHalf === 0) return [{ x: b.x, y: b.y }];
  const radius = Math.abs(chord / (2 * sinHalf));
  const h = (chord / 2) / Math.tan(theta / 2); // midpoint → centre offset (signed)
  const cx = (a.x + b.x) / 2 + (-dy / chord) * h;
  const cy = (a.y + b.y) / 2 + (dx / chord) * h;
  const start = Math.atan2(a.y - cy, a.x - cx);
  const segs = Math.max(3, Math.ceil(Math.abs(theta) / (Math.PI / 16)));
  const pts: Pt[] = [];
  for (let i = 1; i <= segs; i++) {
    const ang = start + (theta * i) / segs;
    pts.push({ x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) });
  }
  return pts;
};

/** POLYLINE / LWPOLYLINE vertices expanded through bulge arcs. A closed polyline
 *  gets its closing segment (including the last vertex's bulge) appended so the
 *  point list is a single continuous ring. */
const polylinePoints = (e: any): Pt[] => {
  const vs: any[] = e.vertices || [];
  if (vs.length === 0) return [];
  if (vs.length === 1) return [{ x: vs[0].x, y: vs[0].y }];
  const closed = e.shape === true || e.closed === true;
  const segCount = closed ? vs.length : vs.length - 1;
  const pts: Pt[] = [{ x: vs[0].x, y: vs[0].y }];
  for (let i = 0; i < segCount; i++) {
    const a = vs[i], b = vs[(i + 1) % vs.length];
    for (const p of bulgePoints({ x: a.x, y: a.y }, { x: b.x, y: b.y }, a.bulge || 0)) pts.push(p);
  }
  return pts;
};

/** ELLIPSE swept from startAngle → endAngle (radians, per DXF spec). */
const ellipsePoints = (e: any): Pt[] => {
  const c = e.center, m = e.majorAxisEndPoint;
  if (!c || !m) return [];
  const major = Math.hypot(m.x, m.y);
  if (!(major > 0)) return [];
  const minor = major * (typeof e.axisRatio === 'number' ? e.axisRatio : 1);
  const ux = m.x / major, uy = m.y / major;
  const vx = -uy, vy = ux;
  let t0 = typeof e.startAngle === 'number' ? e.startAngle : 0;
  let t1 = typeof e.endAngle === 'number' ? e.endAngle : Math.PI * 2;
  if (t1 <= t0) t1 += Math.PI * 2;
  const segs = Math.max(8, Math.ceil((t1 - t0) / (Math.PI / 16)));
  const pts: Pt[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = t0 + ((t1 - t0) * i) / segs;
    const ct = Math.cos(t), st = Math.sin(t);
    pts.push({ x: c.x + major * ct * ux + minor * st * vx, y: c.y + major * ct * uy + minor * st * vy });
  }
  return pts;
};

/** SPLINE approximated by its fit points (or control polygon as fallback). */
const splinePoints = (e: any): Pt[] => {
  const src: any[] =
    (Array.isArray(e.fitPoints) && e.fitPoints.length >= 2 && e.fitPoints) ||
    e.controlPoints || [];
  return src.map((p: any) => ({ x: p.x, y: p.y }));
};

/**
 * Extract the drawable point list for every entity type we understand —
 * LINE, bulged POLYLINE/LWPOLYLINE, ARC, CIRCLE, ELLIPSE and SPLINE —
 * so the preview and the measured quantities always agree on the geometry.
 */
export const entityPoints = (e: any): Pt[] => {
  if (!e) return [];
  if (e.type === 'LINE') {
    if (e.vertices && e.vertices.length >= 2) return e.vertices.map((v: any) => ({ x: v.x, y: v.y }));
    if (e.startPoint && e.endPoint)
      return [{ x: e.startPoint.x, y: e.startPoint.y }, { x: e.endPoint.x, y: e.endPoint.y }];
    return [];
  }
  if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') return polylinePoints(e);
  if (e.type === 'ARC' && e.center && typeof e.radius === 'number' &&
      typeof e.startAngle === 'number' && typeof e.endAngle === 'number') {
    return arcPoints(e.center, e.radius, e.startAngle, e.endAngle);
  }
  if (e.type === 'CIRCLE' && e.center && typeof e.radius === 'number') {
    return arcPoints(e.center, e.radius, 0, Math.PI * 2);
  }
  if (e.type === 'ELLIPSE') return ellipsePoints(e);
  if (e.type === 'SPLINE') return splinePoints(e);
  return [];
};

/**
 * Exact length of an entity in drawing units. Arcs and bulge segments are
 * measured along the curve (chord-only measurement under-reports curved
 * geometry — a R3 quarter arc is 4.71 units, not 4.24).
 */
export const entityLengthUnits = (e: any): number => {
  if (!e) return 0;
  if (e.type === 'LINE') {
    const pts = entityPoints(e);
    return pts.length >= 2 ? segLen(pts[0], pts[1]) : 0;
  }
  if (e.type === 'ARC') {
    if (!(e.radius > 0)) return 0;
    let sweep = typeof e.angleLength === 'number' ? e.angleLength : e.endAngle - e.startAngle;
    sweep = sweep % (Math.PI * 2);
    if (sweep < 0) sweep += Math.PI * 2;
    return e.radius * sweep;
  }
  if (e.type === 'CIRCLE') return typeof e.radius === 'number' && e.radius > 0 ? 2 * Math.PI * e.radius : 0;
  if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
    const vs: any[] = e.vertices || [];
    if (vs.length < 2) return 0;
    const closed = e.shape === true || e.closed === true;
    const segCount = closed ? vs.length : vs.length - 1;
    let total = 0;
    for (let i = 0; i < segCount; i++) {
      const a = vs[i], b = vs[(i + 1) % vs.length];
      const chord = segLen(a, b);
      const bulge = a.bulge || 0;
      if (bulge) {
        const theta = Math.abs(4 * Math.atan(bulge));
        const sinHalf = Math.sin(theta / 2);
        if (sinHalf > 0) {
          total += theta * (chord / (2 * sinHalf)); // arc length = |θ| × r
          continue;
        }
      }
      total += chord;
    }
    return total;
  }
  const pts = entityPoints(e);
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += segLen(pts[i], pts[i + 1]);
  if (isClosedPoly(e)) total += segLen(pts[pts.length - 1], pts[0]);
  return total;
};

/** SVG path data for an entity's tessellated geometry (drawing coordinates). */
export const ptsToPath = (pts: Pt[], closed = false): string => {
  if (!pts || pts.length < 2) return '';
  let d = `M ${fmtNum(pts[0].x)} ${fmtNum(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${fmtNum(pts[i].x)} ${fmtNum(pts[i].y)}`;
  return closed ? d + ' Z' : d;
};

export const entityPathData = (e: any): string => ptsToPath(entityPoints(e), isClosedPoly(e));

// ---- Noise layers --------------------------------------------------------

/**
 * Layers that never contribute to take-off: construction/defpoints geometry,
 * annotation, dimensions, hatching, title blocks. Used to pre-seed the layer
 * visibility toggles when a file is parsed so a raw import measures real
 * geometry only — the layers stay listed and can be toggled back on.
 */
export const AUTO_IGNORE_LAYER_PATTERNS: RegExp[] = [
  /defpoint/i, /annot/i, /\banno/i, /dimension/i, /\bdim[\s_\-]/i, /hatch/i,
  /title/i, /viewport/i, /xref/i, /underlay/i
];

export const isAutoIgnoredLayer = (layer: string): boolean =>
  !!layer && AUTO_IGNORE_LAYER_PATTERNS.some(p => p.test(layer));

// ---- INSERT block flattening --------------------------------------------

interface Mat { a: number; b: number; c: number; d: number; e: number; f: number }
interface FlatPrim { layer: string; pts: Pt[]; closed: boolean }

/** 2×3 affine matrix for an INSERT (scale → rotate → translate, DXF order). */
const insertMat = (ins: any): Mat => {
  const xs = typeof ins.xScale === 'number' && ins.xScale !== 0 ? ins.xScale : 1;
  const ys = typeof ins.yScale === 'number' && ins.yScale !== 0 ? ins.yScale : 1;
  const rot = ((typeof ins.rotation === 'number' ? ins.rotation : 0) * Math.PI) / 180; // dxf-parser keeps degrees
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const p = ins.position || { x: 0, y: 0 };
  return { a: xs * cos, b: -ys * sin, c: xs * sin, d: ys * cos, e: p.x, f: p.y };
};

const mulMat = (P: Mat, C: Mat): Mat => ({
  a: P.a * C.a + P.b * C.c,
  b: P.a * C.b + P.b * C.d,
  c: P.c * C.a + P.d * C.c,
  d: P.c * C.b + P.d * C.d,
  e: P.a * C.e + P.b * C.f + P.e,
  f: P.c * C.e + P.d * C.f + P.f
});

const applyMat = (m: Mat, p: Pt): Pt => ({ x: m.a * p.x + m.b * p.y + m.e, y: m.c * p.x + m.d * p.y + m.f });

const walkBlock = (
  dxf: any, blockName: string, m: Mat, displayLayer: string,
  out: FlatPrim[], path: string[], depth: number
) => {
  if (depth > 4 || path.includes(blockName)) return; // depth cap + cycle guard
  const block = dxf && dxf.blocks ? dxf.blocks[blockName] : null;
  const ents: any[] = (block && block.entities) || [];
  for (const e of ents) {
    if (e.type === 'INSERT') {
      if (e.name) walkBlock(dxf, e.name, mulMat(m, insertMat(e)), displayLayer, out, [...path, blockName], depth + 1);
      continue;
    }
    const pts = entityPoints(e);
    if (pts.length < 2) continue;
    out.push({ layer: displayLayer, pts: pts.map(p => applyMat(m, p)), closed: isClosedPoly(e) });
  }
};

/**
 * Flatten an INSERT into transformed primitive point lists — rotation, x/y
 * scale and nested block references all applied. Each primitive is tagged with
 * the INSERT's own layer so preview highlighting & layer exclusion follow the
 * top-level symbol the drafter placed, not the block's internal layer "0".
 */
export const flattenInsertEntities = (dxf: any, insert: any): FlatPrim[] => {
  const out: FlatPrim[] = [];
  if (!insert || insert.type !== 'INSERT' || !insert.name) return out;
  walkBlock(dxf, insert.name, insertMat(insert), insert.layer || '', out, [], 0);
  return out;
};

/** Total length of an INSERT's flattened geometry, in drawing units. */
export const insertLengthUnits = (dxf: any, insert: any): number => {
  let total = 0;
  for (const prim of flattenInsertEntities(dxf, insert)) {
    total += polylineLengthMeters(prim.pts, 1, prim.closed);
  }
  return total;
};

// ---- Unit guessing -------------------------------------------------------

/**
 * Best-effort drawing unit for files without $INSUNITS: bucket the largest
 * dimension of the flattened geometry. Metric is preferred because feet-vs-
 * metres cannot be resolved from geometry alone; the guess is surfaced in the
 * UI as "auto-guessed" and stays overridable with the Drawing Unit selector.
 *
 *   ≥ 2000 → mm (a 2 m wall = 2000 mm)   ≥ 200 → cm (a 2 m wall = 200 cm)
 *   ≥ 10   → m  (a 10 m plan)            ≥ 3   → ft (a 10 ft room)
 */
export const guessUnitFromExtents = (dxf: any): DxfUnit => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const acc = (pts: Pt[]) => {
    for (const p of pts) {
      if (!isFinite(p.x) || !isFinite(p.y)) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  };
  const entities: any[] = (dxf && dxf.entities) || [];
  for (const e of entities) {
    if (e.type === 'INSERT') {
      for (const prim of flattenInsertEntities(dxf, e)) acc(prim.pts);
    } else {
      acc(entityPoints(e));
    }
  }
  const span = Math.max(maxX - minX, maxY - minY);
  if (!isFinite(span) || span <= 0) return 'unknown';
  if (span >= 2000) return 'millimeters';
  if (span >= 200) return 'centimeters';
  if (span >= 10) return 'meters';
  if (span >= 3) return 'feet';
  return 'unknown';
};

// ---- Preview -------------------------------------------------------------

export interface PreviewShape {
  /** Layer that drives selection/highlight (the INSERT's layer for block content). */
  layer: string;
  pts: Pt[];
  closed: boolean;
  /** SVG path data in drawing coordinates. */
  d: string;
}

/**
 * Flatten everything the preview can draw — lines, arcs, circles, bulged
 * polylines, splines, ellipses and INSERT block symbols — into SVG paths.
 * Layers listed in `excludeLayers` are skipped entirely (their block content
 * too, since block primitives inherit their INSERT's layer).
 */
export const collectPreviewShapes = (dxf: any, opts: { excludeLayers?: string[] } = {}): PreviewShape[] => {
  const exclude = new Set(opts.excludeLayers || []);
  const out: PreviewShape[] = [];
  const entities: any[] = (dxf && dxf.entities) || [];
  for (const e of entities) {
    const layer = e.layer || '';
    if (layer && exclude.has(layer)) continue;
    if (e.type === 'INSERT') {
      for (const prim of flattenInsertEntities(dxf, e)) {
        const d = ptsToPath(prim.pts, prim.closed);
        if (d) out.push({ layer, pts: prim.pts, closed: prim.closed, d });
      }
      continue;
    }
    const pts = entityPoints(e);
    if (pts.length < 2) continue;
    const closed = isClosedPoly(e);
    const d = ptsToPath(pts, closed);
    if (d) out.push({ layer, pts, closed, d });
  }
  return out;
};

// ---- Component model -----------------------------------------------------

export type ComponentKind =
  | 'wall' | 'column' | 'beam' | 'slab' | 'window' | 'door' | 'toilet' | 'fixture';

export interface ComponentSpec {
  kind: ComponentKind;
  label: string;
  category: MeasurementCategory;
  /** 'length' linear (m), 'area' (m²), or 'count' (pcs). */
  measure: 'length' | 'area' | 'count';
  /** Layer-name patterns (case-insensitive) that map to this component. */
  layerPatterns?: RegExp[];
  /** Block-name patterns (case-insensitive) for INSERT symbols. */
  blockPatterns?: RegExp[];
  /** Entity types that contribute linear geometry to this component. */
  entityTypes?: string[];
}

/**
 * Recommended CAD layer naming standard. A drawing formatted to this convention
 * extracts cleanly with zero guessing. This is what you hand to a draftsperson.
 */
export const DXF_STANDARD_LAYERS: { layer: string; purpose: string; measure: string }[] = [
  { layer: 'A-WALL-EXT', purpose: 'External brick/block walls (centerline)', measure: 'Length → m (× thickness × height = m³)' },
  { layer: 'A-WALL-INT', purpose: 'Internal partition walls (centerline)', measure: 'Length → m' },
  { layer: 'A-DOOR', purpose: 'Door leaf symbols as INSERT blocks (DOOR_*)', measure: 'Count → pcs (deducts area in walls/plaster)' },
  { layer: 'A-WIND', purpose: 'Window symbols as INSERT blocks (WIN_*)', measure: 'Count → pcs (deducts area)' },
  { layer: 'S-COLS', purpose: 'RCC columns (closed LWPOLYLINE or COL_* block)', measure: 'Area → m² (× height = m³), or count' },
  { layer: 'S-BEAM', purpose: 'Beam centerlines (LINE / LWPOLYLINE)', measure: 'Length → m (× section = m³)' },
  { layer: 'S-SLAB', purpose: 'Slab outline (closed LWPOLYLINE)', measure: 'Area → m² (× thickness = m³)' },
  { layer: 'P-SANTRY', purpose: 'Sanitary fixtures: WC, basin, sink (INSERT blocks)', measure: 'Count → pcs' },
  { layer: 'A-ROOM', purpose: 'Room name tags (TEXT / MTEXT)', measure: 'Labels (drives area schedule)' },
  { layer: 'A-GRID', purpose: 'Column grid lines', measure: 'Reference only' },
  { layer: 'A-FURN', purpose: 'Furniture & fittings', measure: 'Excluded from BOQ' },
  { layer: 'A-ANNO-TEXT', purpose: 'Notes & title block', measure: 'Excluded from BOQ' },
  { layer: 'A-ANNO-DIMS', purpose: 'Dimension entities', measure: 'Excluded from BOQ' },
  { layer: 'DEFPOINTS', purpose: 'CAD construction points', measure: 'Excluded from BOQ' }
];

/** Recommended block naming for symbol libraries. */
export const DXF_BLOCK_STANDARD: string[] = [
  'DOOR_900 / DOOR_750 / DOOR_3-7   → door leaf symbol (swing arc + leaf lines)',
  'WIN_1200 / WIN_4X5              → window symbol (frame rectangle + mullions)',
  'COL_300X450 / PILLAR_1          → column symbol (footprint cross-section)',
  'WC / SINK / BASIN / SHOWER      → sanitary fixture symbol',
  'Prefix every symbol block with the component type so it extracts by name.'
];

/** Default extraction rules. Block rules are matched before layer rules. */
export const DEFAULT_RULES: ComponentSpec[] = [
  {
    kind: 'wall', label: 'Brick Masonry / Wall', category: 'Superstructure', measure: 'length',
    layerPatterns: [/wall/i], entityTypes: ['LINE', 'LWPOLYLINE', 'POLYLINE']
  },
  {
    kind: 'column', label: 'RCC Column', category: 'Superstructure', measure: 'area',
    layerPatterns: [/col/i, /pillar/i], blockPatterns: [/^col[_-]/i, /pillar/i]
  },
  {
    kind: 'beam', label: 'RCC Beam', category: 'Superstructure', measure: 'length',
    layerPatterns: [/beam/i], entityTypes: ['LINE', 'LWPOLYLINE', 'POLYLINE']
  },
  {
    kind: 'slab', label: 'RCC Slab', category: 'Superstructure', measure: 'area',
    layerPatterns: [/slab/i, /flor/i]
  },
  {
    kind: 'window', label: 'Window', category: 'Finishing', measure: 'count',
    layerPatterns: [/wind/i, /glaz/i], blockPatterns: [/win/i, /glaz/i, /window/i]
  },
  {
    kind: 'door', label: 'Door', category: 'Finishing', measure: 'count',
    layerPatterns: [/door/i], blockPatterns: [/door/i]
  },
  {
    kind: 'toilet', label: 'Sanitary Fixture (WC)', category: 'MEP Works', measure: 'count',
    layerPatterns: [/\bwc\b/i, /toilet/i, /sanit/i, /santry/i], blockPatterns: [/\bwc\b/i, /toilet/i, /water\s*closet/i]
  },
  {
    kind: 'fixture', label: 'Sanitary Fitting (basin/sink)', category: 'MEP Works', measure: 'count',
    layerPatterns: [/fix/i, /plumb/i, /sanit/i], blockPatterns: [/sink/i, /basin/i, /shower/i, /tap/i]
  }
];

// ---- Classification ------------------------------------------------------

/** Match a layer / block name / entity type to a component rule. */
export const matchRule = (opts: { layer?: string; blockName?: string; entityType?: string }, rules = DEFAULT_RULES): ComponentSpec | null => {
  const { layer = '', blockName = '', entityType = '' } = opts;
  // Block symbols are the strongest signal — check first.
  for (const rule of rules) {
    if (blockName && rule.blockPatterns && rule.blockPatterns.some(p => p.test(blockName))) return rule;
  }
  // Then layer name.
  for (const rule of rules) {
    if (layer && rule.layerPatterns && rule.layerPatterns.some(p => p.test(layer))) return rule;
  }
  // Finally layer + entity type together (e.g. wall lines).
  for (const rule of rules) {
    if (layer && rule.entityTypes && rule.layerPatterns &&
        rule.layerPatterns.some(p => p.test(layer)) && rule.entityTypes.includes(entityType)) {
      return rule;
    }
  }
  return null;
};

/**
 * Heuristic for anonymous INSERT blocks (e.g. AutoCAD "A$C...." symbols).
 * A block with ARC(s) + several polylines/lines is a door swing; a compact
 * rectangle-only block is likely a window. Returns a spec or null.
 */
export const classifyBlockGeometry = (block: any, rules = DEFAULT_RULES): ComponentSpec | null => {
  const ents: any[] = (block && block.entities) || [];
  if (!ents.length) return null;
  const counts: Record<string, number> = {};
  ents.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });
  const arcCount = counts.ARC || 0;
  const lineCount = counts.LINE || 0;
  const polyCount = (counts.LWPOLYLINE || 0) + (counts.POLYLINE || 0);
  if (arcCount >= 1 && lineCount + polyCount >= 2) {
    return rules.find(r => r.kind === 'door') || null;
  }
  if (polyCount >= 1 && arcCount === 0) {
    return rules.find(r => r.kind === 'window') || null;
  }
  return null;
};

/**
 * Sum the footprint area (m²) of a block definition — used for column INSERTs,
 * where the cross-section lives inside the block. Considers closed LWPOLYLINEs
 * and CIRCLEs, scaled by the insert's x/y scale and the drawing-unit scale.
 */
const blockFootprintAreaM2 = (block: any, insertScale: number, unitScale: number): number => {
  const ents: any[] = (block && block.entities) || [];
  let area = 0;
  for (const e of ents) {
    if (e.type === 'CIRCLE' && typeof e.radius === 'number') {
      area += Math.PI * e.radius * e.radius;
    } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.shape === true && e.vertices && e.vertices.length >= 3) {
      const pts = e.vertices.map((v: any) => ({ x: v.x, y: v.y }));
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      area += Math.abs(a) / 2;
    }
  }
  // area is in drawing units²; convert to m² and apply the insert scale.
  return area * (insertScale * insertScale) * (unitScale * unitScale);
};

// ---- Extraction ----------------------------------------------------------

export interface ExtractedComponent {
  kind: ComponentKind;
  label: string;
  category: MeasurementCategory;
  measure: 'length' | 'area' | 'count';
  count: number;      // instances (windows/doors/columns/fixtures)
  lengthM: number;    // total linear meters (walls/beams)
  areaM2: number;     // total area (slabs / column footprints)
  layers: string[];
  blockNames: string[];
}

export interface DxfExtractionOptions {
  wallThickness?: number;  // m, default 0.23 (9" brick — NBC 205 wall thickness)
  height?: number;         // m, default project.standardWallHeight
  slabThickness?: number;  // m, default 0.125 (5" — NBC 205 roof/floor slab)
  rules?: ComponentSpec[];
  /** Force a drawing unit instead of trusting $INSUNITS (for files with none). */
  unitOverride?: DxfUnit;
  /** Layers to exclude from measurement (per-layer visibility toggles). */
  excludeLayers?: string[];
}

export interface DxfExtraction {
  /** Effective unit used (after override). */
  unit: DxfUnit;
  /** Unit auto-detected from the file's $INSUNITS header. */
  detectedUnit: DxfUnit;
  /** True when the effective unit came from an override, not the header. */
  unitOverridden: boolean;
  scale: number;
  entityTotal: number;
  layers: string[];
  insertBlockNames: { name: string; count: number }[];
  components: ExtractedComponent[];
  textTags: string[];
  /** True when neither the header nor an override established a real unit. */
  unitUnknown: boolean;
  /** True when the unit was auto-guessed from the drawing extents (no $INSUNITS). */
  unitGuessed: boolean;
}

const emptyComponent = (spec: ComponentSpec): ExtractedComponent => ({
  kind: spec.kind, label: spec.label, category: spec.category, measure: spec.measure,
  count: 0, lengthM: 0, areaM2: 0, layers: [], blockNames: []
});

export const extractComponents = (dxf: any, options: DxfExtractionOptions = {}): DxfExtraction => {
  const rules = options.rules || DEFAULT_RULES;
  const detectedUnit = detectDxfUnit(dxf);
  let unit = options.unitOverride && options.unitOverride !== 'unknown' ? options.unitOverride : detectedUnit;
  let unitGuessed = false;
  if (unit === 'unknown') {
    // No $INSUNITS and no override: bucket the drawing extents (mm/cm/m/ft).
    // The guess is surfaced in the UI and stays overridable by the user.
    const guess = guessUnitFromExtents(dxf);
    if (guess !== 'unknown') {
      unit = guess;
      unitGuessed = true;
    }
  }
  const unitOverridden = !unitGuessed && unit !== detectedUnit;
  const scale = unitToMeters(unit);
  const entities: any[] = (dxf && dxf.entities) || [];
  const exclude = new Set<string>(options.excludeLayers || []);

  const byKind = new Map<ComponentKind, ExtractedComponent>();
  const ensure = (spec: ComponentSpec) => {
    if (!byKind.has(spec.kind)) byKind.set(spec.kind, emptyComponent(spec));
    return byKind.get(spec.kind)!;
  };
  const pushLayer = (c: ExtractedComponent, layer: string) => { if (layer && !c.layers.includes(layer)) c.layers.push(layer); };
  const pushBlock = (c: ExtractedComponent, name: string) => { if (name && !c.blockNames.includes(name)) c.blockNames.push(name); };

  const layerSet = new Set<string>();
  const blockCounts: Record<string, number> = {};
  const textTags: string[] = [];

  for (const e of entities) {
    const layer = e.layer || '';
    if (layer) layerSet.add(layer);
    // Per-layer visibility toggle: hidden layers are excluded from measurement
    // (but still listed so the UI can show the toggle).
    if (layer && exclude.has(layer)) continue;

    if (e.type === 'INSERT') {
      const blockName = e.name || '';
      if (blockName) blockCounts[blockName] = (blockCounts[blockName] || 0) + 1;
      let spec = matchRule({ blockName }, rules);
      if (!spec && blockName && dxf.blocks && dxf.blocks[blockName]) {
        spec = classifyBlockGeometry(dxf.blocks[blockName], rules);
      }
      // Fallback: classify an unnamed/unmatched symbol by the layer it was
      // placed on (e.g. a pre-drawn wall/beam segment block on A-WALL-EXT).
      if (!spec) spec = matchRule({ layer }, rules);
      if (spec) {
        const c = ensure(spec);
        c.count += 1;
        // For area-measured components placed as blocks (e.g. RCC columns), derive
        // the footprint area from the block definition's closed geometry.
        if (spec.measure === 'area' && blockName && dxf.blocks && dxf.blocks[blockName]) {
          const ins = typeof e.xScale === 'number' && e.xScale > 0 ? e.xScale : 1;
          c.areaM2 += blockFootprintAreaM2(dxf.blocks[blockName], ins, scale);
        } else if (spec.measure === 'length') {
          // Measure the flattened block geometry (rotation & scale applied).
          c.lengthM += insertLengthUnits(dxf, e) * scale;
        }
        pushLayer(c, layer);
        pushBlock(c, blockName);
      }
      continue;
    }

    if (e.type === 'CIRCLE' && e.center && typeof e.radius === 'number') {
      const spec = matchRule({ layer, entityType: 'CIRCLE' }, rules);
      if (spec && spec.measure === 'area') {
        const c = ensure(spec);
        c.areaM2 += Math.PI * e.radius * e.radius * scale * scale;
        c.count += 1;
        pushLayer(c, layer);
      } else if (spec && spec.measure === 'length') {
        // Circles on length-measured layers (e.g. round wall bays / curved roofs).
        const c = ensure(spec);
        c.lengthM += 2 * Math.PI * e.radius * scale;
        pushLayer(c, layer);
      }
      continue;
    }

    const pts = entityPoints(e);
    if (pts.length >= 2) {
      const spec = matchRule({ layer, entityType: e.type }, rules);
      if (spec && spec.measure === 'length') {
        const c = ensure(spec);
        // Exact curve length — arcs & bulge segments measured along the curve.
        c.lengthM += entityLengthUnits(e) * scale;
      } else if (spec && spec.measure === 'area') {
        const c = ensure(spec);
        if (isClosedPoly(e)) c.areaM2 += polygonAreaMeters(pts, scale);
        c.count += 1;
        pushLayer(c, layer);
      }
    }

    if ((e.type === 'TEXT' || e.type === 'MTEXT') && e.text) {
      const t = String(e.text).replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
      if (t && t.length <= 12) textTags.push(t);
    }
  }

  const components = Array.from(byKind.values())
    .map(c => ({ ...c, lengthM: +c.lengthM.toFixed(2), areaM2: +c.areaM2.toFixed(2) }))
    .sort((a, b) => a.kind.localeCompare(b.kind));

  const insertBlockNames = Object.entries(blockCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    unit, detectedUnit, unitOverridden, scale, entityTotal: entities.length, layers: Array.from(layerSet).sort(),
    insertBlockNames, components, textTags, unitUnknown: unit === 'unknown', unitGuessed
  };
};

// ---- Sample template generator ------------------------------------------

/**
 * Build a complete, spec-compliant sample DXF that follows DXF_STANDARD_LAYERS /
 * DXF_BLOCK_STANDARD. Geometry is authored in METERS (header $INSUNITS = 6) so it
 * extracts cleanly with every unit/layer assumption correct. Represents a small
 * 12 m x 9 m villa: perimeter + partition walls, curved bay arc, columns,
 * beams, slab, doors, windows, WC + sink, room tags, grids and annotation.
 */
export const buildSampleTemplateDxf = (): string => {
  const out: string[] = [];
  const push = (...vals: (string | number)[]) => { vals.forEach(v => out.push(String(v))); };
  // group code pair helper: gp(8, 'A-WALL-EXT')
  const gp = (code: number | string, value: string | number) => push(code, value);

  // ---- HEADER (R12-compatible; units = meters via $INSUNITS) ----
  // NOTE: emitted as AC1009 (R12) on purpose — R12 needs no subclass markers,
  // handles, or model/paper-space records, so hand-written files open in
  // AutoCAD, BricsCAD, LibreCAD and ODA viewers. Closed outlines use
  // POLYLINE/VERTEX/SEQEND (LWPOLYLINE did not exist in R12).
  gp(0, 'SECTION'); gp(2, 'HEADER');
  gp(9, '$ACADVER'); gp(1, 'AC1009');
  gp(9, '$INSUNITS'); gp(70, 6); // 6 = meters (read by StructEst; ignored by R12 CAD)
  gp(9, '$EXTMIN'); gp(10, -1.0); gp(20, -1.0); gp(30, 0.0);
  gp(9, '$EXTMAX'); gp(10, 13.0); gp(20, 10.0); gp(30, 0.0);
  gp(0, 'ENDSEC');

  // ---- TABLES: linetypes + full standard layers + text style ----
  // CAD requires the CONTINUOUS linetype and STANDARD style that layers/TEXT refer to.
  gp(0, 'SECTION'); gp(2, 'TABLES');
  gp(0, 'TABLE'); gp(2, 'LTYPE'); gp(70, 1);
  gp(0, 'LTYPE'); gp(2, 'CONTINUOUS'); gp(70, 0);
  gp(3, 'Solid line'); gp(72, 65); gp(73, 0); gp(40, 0.0);
  gp(0, 'ENDTAB');
  gp(0, 'TABLE'); gp(2, 'LAYER'); gp(70, 14);
  const layerTable: [string, number][] = [
    ['A-WALL-EXT', 7], ['A-WALL-INT', 7], ['A-DOOR', 3], ['A-WIND', 4],
    ['S-COLS', 1], ['S-BEAM', 5], ['S-SLAB', 2], ['P-SANTRY', 6],
    ['A-ROOM', 2], ['A-GRID', 8], ['A-FURN', 8],
    ['A-ANNO-TEXT', 7], ['A-ANNO-DIMS', 3], ['DEFPOINTS', 7]
  ];
  layerTable.forEach(([name, color]) => {
    gp(0, 'LAYER'); gp(2, name); gp(70, 0); gp(62, color); gp(6, 'Continuous');
  });
  gp(0, 'ENDTAB');
  gp(0, 'TABLE'); gp(2, 'STYLE'); gp(70, 1);
  gp(0, 'STYLE'); gp(2, 'STANDARD'); gp(70, 0); gp(40, 0.0); gp(41, 1.0);
  gp(50, 0.0); gp(71, 0); gp(42, 0.2); gp(3, 'txt'); gp(4, '');
  gp(0, 'ENDTAB');
  gp(0, 'ENDSEC');

  // ---- BLOCKS: named symbols ----
  gp(0, 'SECTION'); gp(2, 'BLOCKS');

  const beginBlock = (name: string) => {
    gp(0, 'BLOCK'); gp(8, '0'); gp(2, name); gp(70, 64); gp(10, 0); gp(20, 0); gp(30, 0); gp(3, name); gp(1, '');
  };
  const endBlock = () => { gp(0, 'ENDBLK'); gp(8, '0'); };
  // R12 closed outline: POLYLINE + VERTEX list + SEQEND (flag 70=1 → closed).
  const closedPoly = (pts: [number, number][]) => {
    gp(0, 'POLYLINE'); gp(8, '0'); gp(66, 1); gp(70, 1);
    pts.forEach(([x, y]) => { gp(0, 'VERTEX'); gp(8, '0'); gp(10, x); gp(20, y); gp(30, 0); });
    gp(0, 'SEQEND'); gp(8, '0');
  };

  // DOOR_900: leaf line + 90° swing arc (origin = hinge point)
  beginBlock('DOOR_900');
  gp(0, 'LINE'); gp(8, '0'); gp(10, 0); gp(20, 0); gp(30, 0); gp(11, 0); gp(21, 0.9); gp(31, 0);
  gp(0, 'ARC'); gp(8, '0'); gp(10, 0); gp(20, 0); gp(30, 0); gp(40, 0.9); gp(50, 0); gp(51, 90);
  endBlock();

  // DOOR_750: narrower leaf for bathroom / interior
  beginBlock('DOOR_750');
  gp(0, 'LINE'); gp(8, '0'); gp(10, 0); gp(20, 0); gp(30, 0); gp(11, 0); gp(21, 0.75); gp(31, 0);
  gp(0, 'ARC'); gp(8, '0'); gp(10, 0); gp(20, 0); gp(30, 0); gp(40, 0.75); gp(50, 0); gp(51, 90);
  endBlock();

  // WIN_1500: frame rectangle 1.5 x 0.23 (wall thickness) + centre mullions.
  beginBlock('WIN_1500');
  closedPoly([[0, 0], [1.5, 0], [1.5, 0.23], [0, 0.23]]);
  gp(0, 'LINE'); gp(8, '0'); gp(10, 0.75); gp(20, 0); gp(30, 0); gp(11, 0.75); gp(21, 0.23); gp(31, 0);
  gp(0, 'LINE'); gp(8, '0'); gp(10, 0); gp(20, 0.115); gp(30, 0); gp(11, 1.5); gp(21, 0.115); gp(31, 0);
  endBlock();

  // COL_350X350: NBC 205 column footprint (350 x 350 mm), centred on origin
  beginBlock('COL_350X350');
  closedPoly([[-0.175, -0.175], [0.175, -0.175], [0.175, 0.175], [-0.175, 0.175]]);
  endBlock();

  // WC: cistern rectangle (0.6 x 0.2) + bowl circle
  beginBlock('WC');
  closedPoly([[0, 0], [0.6, 0], [0.6, 0.2], [0, 0.2]]);
  gp(0, 'CIRCLE'); gp(8, '0'); gp(10, 0.3); gp(20, 0.45); gp(30, 0); gp(40, 0.2);
  endBlock();

  // SINK_600: counter rectangle 0.6 x 0.5 + basin circle
  beginBlock('SINK_600');
  closedPoly([[0, 0], [0.6, 0], [0.6, 0.5], [0, 0.5]]);
  gp(0, 'CIRCLE'); gp(8, '0'); gp(10, 0.3); gp(20, 0.25); gp(30, 0); gp(40, 0.16);
  endBlock();

  // R12 model-space scaffolding: *MODEL_SPACE + *PAPER_SPACE are mandatory
  // BLOCK records or AutoCAD reports "Invalid block name" on open.
  gp(0, 'BLOCK'); gp(8, '0'); gp(2, '*MODEL_SPACE'); gp(70, 0); gp(10, 0); gp(20, 0); gp(30, 0); gp(3, '*MODEL_SPACE'); gp(1, '');
  gp(0, 'ENDBLK'); gp(8, '0');
  gp(0, 'BLOCK'); gp(8, '0'); gp(2, '*PAPER_SPACE'); gp(70, 0); gp(10, 0); gp(20, 0); gp(30, 0); gp(3, '*PAPER_SPACE'); gp(1, '');
  gp(0, 'ENDBLK'); gp(8, '0');

  gp(0, 'ENDSEC');

  // ---- ENTITIES ----
  gp(0, 'SECTION'); gp(2, 'ENTITIES');

  // External walls: 12 x 9 m rectangle (perimeter = 42 m)
  const W = 12, H = 9;
  const wall = (x1: number, y1: number, x2: number, y2: number, layer = 'A-WALL-EXT') => {
    gp(0, 'LINE'); gp(8, layer); gp(10, x1); gp(20, y1); gp(30, 0); gp(11, x2); gp(21, y2); gp(31, 0);
  };
  wall(0, 0, W, 0); wall(W, 0, W, H); wall(W, H, 0, H); wall(0, H, 0, 0);
  // Internal partitions — two rooms + bathroom bay
  wall(4, 0, 4, H, 'A-WALL-INT');
  wall(8, 0, 8, 5, 'A-WALL-INT');
  wall(8, 5, W, 5, 'A-WALL-INT');
  // Curved garden-bay: quarter-arc wall, R3 (~4.71 m) — exercises ARC measurement
  gp(0, 'ARC'); gp(8, 'A-WALL-INT'); gp(10, 8); gp(20, 5); gp(30, 0); gp(40, 3); gp(50, 180); gp(51, 270);
  // Round column, Dia 400 (closed CIRCLE) — exercises circle-area on S-COLS
  gp(0, 'CIRCLE'); gp(8, 'S-COLS'); gp(10, 2); gp(20, 4.5); gp(30, 0); gp(40, 0.2);

  // Beams: ridge + spine (offset 0.15 so they preview beside the wall centreline)
  gp(0, 'LINE'); gp(8, 'S-BEAM'); gp(10, 0); gp(20, H - 0.15); gp(30, 0); gp(11, W); gp(21, H - 0.15); gp(31, 0);
  gp(0, 'LINE'); gp(8, 'S-BEAM'); gp(10, 4.15); gp(20, 0); gp(30, 0); gp(11, 4.15); gp(21, H); gp(31, 0);

  // Slab: closed rectangle outline (108 m²) — R12 POLYLINE + SEQEND
  gp(0, 'POLYLINE'); gp(8, 'S-SLAB'); gp(66, 1); gp(70, 1);
  ([
    [0, 0], [W, 0], [W, H], [0, H],
  ] as [number, number][]).forEach(([x, y]) => {
    gp(0, 'VERTEX'); gp(8, 'S-SLAB'); gp(10, x); gp(20, y); gp(30, 0);
  });
  gp(0, 'SEQEND'); gp(8, 'S-SLAB');

  // Columns: four INSERT blocks (grid intersections)
  const insert = (name: string, x: number, y: number, layer: string, rot = 0) => {
    gp(0, 'INSERT'); gp(8, layer); gp(2, name); gp(10, x); gp(20, y); gp(30, 0);
    gp(41, 1); gp(42, 1); gp(43, 1); gp(50, rot);
  };
  insert('COL_350X350', 0, 0, 'S-COLS');
  insert('COL_350X350', 4, 4.5, 'S-COLS');
  insert('COL_350X350', 8, 0, 'S-COLS');
  insert('COL_350X350', 12, 9, 'S-COLS');

  // Doors: two 900 leaves + one 750 bathroom leaf
  insert('DOOR_900', 2, 0, 'A-DOOR', 0);
  insert('DOOR_900', 10, H, 'A-DOOR', 180);
  insert('DOOR_750', 8, 5, 'A-DOOR', 90);

  // Windows: four inserts seated on the outer walls
  insert('WIN_1500', 5, -0.115, 'A-WIND', 0);
  insert('WIN_1500', 9, -0.115, 'A-WIND', 0);
  insert('WIN_1500', W - 0.115, 2.5, 'A-WIND', 90);
  insert('WIN_1500', 0.115, 6.5, 'A-WIND', 270);

  // Sanitary: WC + sink (covers both toilet + fixture rules)
  insert('WC', 10.5, 7.5, 'P-SANTRY', 0);
  insert('SINK_600', 9.5, 0.3, 'P-SANTRY', 0);

  // Room tags (A-ROOM TEXT — drives the area schedule, never the BOQ)
  const tag = (text: string, x: number, y: number, h = 0.25) => {
    gp(0, 'TEXT'); gp(8, 'A-ROOM'); gp(10, x); gp(20, y); gp(30, 0); gp(40, h); gp(1, text);
    gp(7, 'STANDARD'); gp(50, 0); gp(41, 1.0); gp(51, 0); gp(71, 0); gp(72, 0); gp(11, x); gp(21, y); gp(31, 0);
  };
  tag('LIVING', 2, 7, 0.3);
  tag('BEDROOM', 6, 7, 0.3);
  tag('KITCHEN', 2, 2, 0.25);
  tag('TOILET', 10, 6, 0.2);

  // Grid lines (A-GRID — reference only). R12-safe: plain CONTINUOUS linetype
  // (CENTER requires a *CENTER definition + shape-file font CAD may not have).
  const grid = (x1: number, y1: number, x2: number, y2: number) => {
    gp(0, 'LINE'); gp(8, 'A-GRID'); gp(10, x1); gp(20, y1); gp(30, 0); gp(11, x2); gp(21, y2); gp(31, 0); gp(6, 'Continuous');
  };
  grid(0, -0.6, W, -0.6); grid(-0.6, 0, -0.6, H);

  // Annotation noise (excluded from take-off, proves the ignore filters)
  gp(0, 'LINE'); gp(8, 'A-ANNO-DIMS'); gp(10, 0); gp(20, -0.4); gp(30, 0); gp(11, W); gp(21, -0.4); gp(31, 0);
  gp(0, 'TEXT'); gp(8, 'A-ANNO-TEXT'); gp(10, 0); gp(20, H + 0.5); gp(30, 0); gp(40, 0.3); gp(1, 'SAMPLE VILLA - 12x9m');
  gp(7, 'STANDARD'); gp(50, 0); gp(41, 1.0); gp(51, 0); gp(71, 0); gp(72, 0); gp(11, 0); gp(21, H + 0.5); gp(31, 0);

  // Furniture (excluded) + a defpoint (excluded)
  gp(0, 'LINE'); gp(8, 'A-FURN'); gp(10, 1); gp(20, 7); gp(30, 0); gp(11, 4); gp(21, 7); gp(31, 0);
  gp(0, 'POINT'); gp(8, 'DEFPOINTS'); gp(10, 0.5); gp(20, 0.5); gp(30, 0);

  gp(0, 'ENDSEC');
  gp(0, 'EOF');

  // Join with CRLF — DXF spec line endings; strict CAD importers reject LF-only files.
  return out.join('\r\n') + '\r\n';
};

// ---- Drafting guide (human-readable spec) ----------------------------------

/**
 * Build a human-readable Markdown drafting guide that an architect / draftsperson
 * can follow to produce a DXF that StructEst extracts cleanly. All content is
 * derived from the live standards (DXF_STANDARD_LAYERS, DXF_BLOCK_STANDARD,
 * DEFAULT_RULES) so the guide can never drift from what the extractor actually
 * reads. Returned as a single Markdown string, ready to download as .md.
 */
export const buildDraftingGuideMarkdown = (): string => {
  const L: string[] = [];
  const p = (s = '') => L.push(s);

  p('# StructEst Pro — CAD Drawing Standard for Automatic Take-Off');
  p();
  p('Follow this standard and StructEst will extract walls, columns, beams, slabs,');
  p('doors, windows and sanitary fixtures **automatically** — no manual measurement.');
  p('If you only have DWG, convert it to DXF first (AutoCAD "Save As → DXF", or a');
  p('free ODA File Converter). DWG cannot be read directly.');
  p();

  p('## 1. Units — author in METERS');
  p();
  p('- Set the drawing unit to **meters** and set the DXF header variable');
  p('  `$INSUNITS = 6`. StructEst reads this to know the drawing scale.');
  p('- If `$INSUNITS` is missing, StructEst auto-guesses the unit from the drawing');
  p('  size (mm / cm / m / ft) and flags it as "auto-guessed" — verify it in-app.');
  p('- Draw geometry at true size (e.g. a 9 m wall is 9.0 units long).');
  p('- Do **not** draw 1 unit = 1 mm or 1 unit = 1 inch — quantities will be wrong.');
  p('- If you cannot set meters, set a known scale and calibrate manually in-app.');
  p();

  p('## 2. Layer standard');
  p();
  p('Put each component type on its recommended layer. Layer names are matched');
  p('case-insensitively and also by keyword, so `A-WALL-EXT` and `walls_outer` both');
  p('work — but the exact names below extract with zero guessing.');
  p();
  p('| Layer | Purpose | How it is measured |');
  p('| --- | --- | --- |');
  DXF_STANDARD_LAYERS.forEach(s => {
    p(`| \`${s.layer}\` | ${s.purpose} | ${s.measure} |`);
  });
  p();

  p('## 3. Block symbol naming (doors, windows, columns, fixtures)');
  p();
  p('Doors, windows, columns and sanitary fixtures should be **INSERT block symbols**,');
  p('not loose geometry. Block names are the strongest signal StructEst reads, so name');
  p('them with a component prefix:');
  p();
  DXF_BLOCK_STANDARD.forEach(b => p(`- ${b}`));
  p();
  p('If a symbol is left as an anonymous block, StructEst falls back to a geometric');
  p('heuristic (an ARC + lines = door; a plain rectangle = window), but explicit');
  p('names are far more reliable.');
  p();

  p('## 4. Supported geometry — curves are measured exactly');
  p();
  p('StructEst flattens every entity to true geometry before measuring, so these');
  p('all contribute correct quantities:');
  p();
  p('- **LINE / LWPOLYLINE / POLYLINE** — including polyline **bulges**: arcs between');
  p('  vertices are measured along the curve, never the straight chord.');
  p('- **ARC / CIRCLE** — measured as radius × sweep angle (a quarter-circle wall bay');
  p('  is its true arc length; round columns use the full circumference).');
  p('- **ELLIPSE / SPLINE** — tessellated and measured along the curve.');
  p('- **INSERT blocks** — block contents are flattened with their rotation and scale,');
  p('  so nested symbols render in the preview and their geometry can be measured.');
  p('- Annotation noise (dimensions, hatches, DEFPOINTS, title-block layers) is');
  p('  hidden by default — toggle any layer back on from the layer list.');
  p();

  p('## 5. What each component becomes in the BOQ');
  p();
  p('| Component | BOQ label | Category | Measure |');
  p('| --- | --- | --- | --- |');
  DEFAULT_RULES.forEach(r => {
    p(`| ${r.kind} | ${r.label} | ${r.category} | ${r.measure} |`);
  });
  p();
  p('- **length** measures (walls, beams) → run length in m; × thickness × height = m³.');
  p('- **area** measures (columns, slab) → footprint/surface area in m²; × height/thickness = m³.');
  p('- **count** measures (doors, windows, fixtures) → number of symbols found (pcs).');
  p();

  p('## 6. Quick checklist before exporting');
  p();
  p('- [ ] `$INSUNITS = 6` (meters) set in the header.');
  p('- [ ] Walls drawn as centerline LINE / LWPOLYLINE on a `*WALL*` layer.');
  p('- [ ] Columns as a closed outline (or a `COL_*` block) on a `*COL*` layer.');
  p('- [ ] Beams as centerlines on a `*BEAM*` layer; slab as a closed outline on a `*SLAB*` layer.');
  p('- [ ] Doors/windows as INSERT blocks named `DOOR_*` / `WIN_*`.');
  p('- [ ] Fixtures as INSERT blocks named `WC` / `SINK` / `BASIN`.');
  p('- [ ] Saved as **DXF** (not DWG).');
  p();

  p('## 7. Non-standard drawings — AI Layer Mapper');
  p();
  p('Drawings that do not follow this standard still extract. Import the DXF, open');
  p('the AutoCAD Vector tab and run the **AI Layer Mapper**: Gemini proposes layer');
  p('and block renames toward the standard from a geometry fingerprint (entity mix,');
  p('lengths, closed areas, text tags — never the drawing geometry itself). You');
  p('review every row and apply the ones you accept; annotations can be marked');
  p('"ignore". Renames rewrite names only — geometry is never changed — the app');
  p('re-extracts immediately, and the normalized DXF is available for download so');
  p('what you measured is exactly what you keep.');
  p();

  return L.join('\n');
};


/** True for closed shapes (closed polylines, full circles, closed splines). */
export const isClosedPoly = (e: any): boolean =>
  e.type === 'CIRCLE' ||
  ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && (e.shape === true || e.closed === true)) ||
  (e.type === 'SPLINE' && e.closed === true);

// ---- AI-assisted layer mapping ---------------------------------------------
// A messy DXF (everything on layer "0", anonymous blocks) can be normalized by
// renaming LAYERS and BLOCKS to the standard names the extractor understands.
// Gemini only *proposes* the mapping from a compact geometry fingerprint; the
// user reviews/approves every row, and the rename is a pure text operation that
// never touches geometry. Quantities stay 100% deterministic either way.

export interface LayerFingerprintEntry {
  name: string;
  entityCount: number;
  entityTypes: Record<string, number>;
  /** Total length of LINE/ARC/… geometry on this layer (m, at detected unit). */
  lengthM: number;
  /** Total area of closed shapes on this layer (m²). */
  areaM2: number;
}

export interface BlockFingerprintEntry {
  name: string;
  uses: number;
  entityCount: number;
  entityTypes: Record<string, number>;
}

export interface DrawingFingerprint {
  unit: DxfUnit;
  entityTotal: number;
  /** Layers sorted by entity count, capped at `maxLayers`. */
  layers: LayerFingerprintEntry[];
  /** INSERT blocks sorted by uses (then size), capped at `maxBlocks`. */
  blocks: BlockFingerprintEntry[];
  textTags: string[];
}

/**
 * Compact, token-bounded summary of a parsed DXF for the layer-mapper prompt.
 * Pure geometry statistics — no full coordinates are sent to the API.
 */
export const buildLayerFingerprint = (dxf: any, opts: { maxLayers?: number; maxBlocks?: number } = {}): DrawingFingerprint => {
  const maxLayers = opts.maxLayers ?? 40;
  const maxBlocks = opts.maxBlocks ?? 30;
  const unit = detectDxfUnit(dxf);
  const scale = unitToMeters(unit === 'unknown' ? 'meters' : unit);
  const entities: any[] = (dxf && dxf.entities) || [];

  const layerMap = new Map<string, LayerFingerprintEntry>();
  const blockUses: Record<string, number> = {};
  const textTags: string[] = [];

  const entryFor = (layer: string): LayerFingerprintEntry => {
    let entry = layerMap.get(layer);
    if (!entry) {
      entry = { name: layer, entityCount: 0, entityTypes: {}, lengthM: 0, areaM2: 0 };
      layerMap.set(layer, entry);
    }
    return entry;
  };

  for (const e of entities) {
    const entry = entryFor(e.layer || '(none)');
    entry.entityCount += 1;
    entry.entityTypes[e.type] = (entry.entityTypes[e.type] || 0) + 1;
    if (e.type === 'INSERT') {
      const name = e.name || '(unnamed)';
      blockUses[name] = (blockUses[name] || 0) + 1;
      continue;
    }
    if (isClosedPoly(e)) {
      const a = polygonAreaMeters(entityPoints(e), scale);
      if (a > 0) entry.areaM2 += a;
    }
    const len = entityLengthUnits(e) * scale;
    if (len > 0) entry.lengthM += len;
    if ((e.type === 'TEXT' || e.type === 'MTEXT') && e.text && textTags.length < 20) {
      textTags.push(String(e.text).replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim().slice(0, 24));
    }
  }

  const blocks: BlockFingerprintEntry[] = [];
  const blockDefs = (dxf && dxf.blocks) || {};
  for (const name of Object.keys(blockDefs)) {
    const ents: any[] = (blockDefs[name] && blockDefs[name].entities) || [];
    if (!ents.length) continue;
    const types: Record<string, number> = {};
    for (const pe of ents) types[pe.type] = (types[pe.type] || 0) + 1;
    blocks.push({ name, uses: blockUses[name] || 0, entityCount: ents.length, entityTypes: types });
  }
  blocks.sort((a, b) => b.uses - a.uses || b.entityCount - a.entityCount);

  const layers = Array.from(layerMap.values())
    .sort((a, b) => b.entityCount - a.entityCount)
    .slice(0, maxLayers)
    .map(l => ({ ...l, lengthM: Math.round(l.lengthM * 100) / 100, areaM2: Math.round(l.areaM2 * 100) / 100 }));

  return { unit, entityTotal: entities.length, layers, blocks: blocks.slice(0, maxBlocks), textTags };
};

export type MapTargetKind = ComponentKind | 'ignore';

export interface MapSuggestion {
  sourceType: 'layer' | 'block';
  sourceName: string;
  targetKind: MapTargetKind;
  /** Standard layer (layer suggestions) or symbol name (block suggestions). */
  targetStandard: string;
  /** 0..1 probability the mapping is correct. */
  confidence: number;
  reason: string;
}

/** Standard layer to rename a matched LAYER to, per component kind. */
export const LAYER_FOR_KIND: Record<ComponentKind, string> = {
  wall: 'A-WALL-EXT', column: 'S-COLS', beam: 'S-BEAM', slab: 'S-SLAB',
  door: 'A-DOOR', window: 'A-WIND', toilet: 'P-SANTRY', fixture: 'P-SANTRY'
};

/** Standard block name to rename a matched SYMBOL to (must match DEFAULT_RULES blockPatterns). */
export const BLOCK_FOR_KIND: Record<ComponentKind, string> = {
  wall: '', column: 'COL_SYM', beam: '', slab: '',
  // 'WC' / 'SINK' deliberately, not 'WC_SYM': /\bwc\b/ needs a boundary after C,
  // and '_' is a word char — 'WC_SYM' would fall through to the geometry
  // heuristic (poly-without-arc → window) and miscount the fixture.
  door: 'DOOR_SYM', window: 'WIN_SYM', toilet: 'WC', fixture: 'SINK'
};

const STANDARD_LAYER_NAMES = new Set(DXF_STANDARD_LAYERS.map(l => l.layer));
const STANDARD_BLOCK_NAMES = new Set(['DOOR_SYM', 'WIN_SYM', 'COL_SYM', 'WC', 'SINK']);
const KINDS: ReadonlySet<string> = new Set<string>(['wall', 'column', 'beam', 'slab', 'door', 'window', 'toilet', 'fixture', 'ignore']);

/**
 * Validate + normalize one model suggestion. Anything out of vocabulary falls
 * back to the derived standard name for its kind (or is dropped). This is the
 * authoritative gate — the API prompt is advisory only.
 */
export const normalizeSuggestion = (raw: any): MapSuggestion | null => {
  if (!raw || typeof raw.sourceName !== 'string' || !raw.sourceName.trim()) return null;
  const sourceType = raw.sourceType === 'block' ? 'block' : 'layer';
  const targetKind: MapTargetKind = KINDS.has(raw.targetKind) ? (raw.targetKind as MapTargetKind) : 'ignore';
  let targetStandard = typeof raw.targetStandard === 'string' ? raw.targetStandard.trim().toUpperCase() : '';
  if (targetKind === 'ignore') {
    targetStandard = '';
  } else {
    const allowed = sourceType === 'layer' ? STANDARD_LAYER_NAMES : STANDARD_BLOCK_NAMES;
    if (!allowed.has(targetStandard)) {
      targetStandard = sourceType === 'layer' ? LAYER_FOR_KIND[targetKind] : BLOCK_FOR_KIND[targetKind];
    }
    if (!targetStandard) return null; // kind can't be expressed as a block rename
  }
  const conf = Number(raw.confidence);
  return {
    sourceType,
    sourceName: raw.sourceName.trim(),
    targetKind,
    targetStandard,
    confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
    reason: typeof raw.reason === 'string' ? raw.reason.slice(0, 160) : ''
  };
};

/** Accepted suggestions → rename maps for `renameDxfText`. */
export const suggestionsToRenames = (sugs: MapSuggestion[]): { layerRenames: Record<string, string>; blockRenames: Record<string, string> } => {
  const layerRenames: Record<string, string> = {};
  const blockRenames: Record<string, string> = {};
  for (const s of sugs) {
    if (s.targetKind === 'ignore' || !s.targetStandard || s.targetStandard === s.sourceName) continue;
    if (s.sourceType === 'layer') layerRenames[s.sourceName] = s.targetStandard;
    else blockRenames[s.sourceName] = s.targetStandard;
  }
  return { layerRenames, blockRenames };
};

/**
 * Group-code-aware text rename of layers/blocks in raw DXF text. Only exact
 * value lines inside the right context are rewritten:
 *  - TABLES → LAYER table, group code 2 (layer definitions)
 *  - BLOCKS → BLOCK records, group code 2 (block definitions, so INSERTs stay valid)
 *  - BLOCKS/ENTITIES → group code 8 (entity layers), INSERT group code 2 (symbol names)
 * Geometry, handles and all other data pass through untouched. Line endings are
 * normalized to \n (every DXF parser accepts LF). The caller re-parses the
 * result, so download ≡ what was measured.
 */
export const renameDxfText = (raw: string, layerRenames: Record<string, string>, blockRenames: Record<string, string>): string => {
  const hasLayers = Object.keys(layerRenames).length > 0;
  const hasBlocks = Object.keys(blockRenames).length > 0;
  if (!hasLayers && !hasBlocks) return raw;
  const lines = raw.split(/\r\n|\r|\n/);
  const out = lines.slice();
  let section = '';
  let table = '';
  let entity = '';
  // DXF is a flat sequence of (group code, value) line pairs.
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const v = (lines[i + 1] || '').trim();
    if (code === '0') {
      if (v === 'SECTION') { section = ''; table = ''; entity = ''; }
      else if (v === 'ENDSEC') { section = ''; table = ''; entity = ''; }
      else if (v === 'TABLE') { table = ''; entity = ''; }
      else if (v === 'ENDTAB') { table = ''; entity = ''; }
      else entity = v;
      continue;
    }
    if (code === '2') {
      if (!section) { section = v; continue; }                     // SECTION name
      if (section === 'TABLES' && !table) { table = v; continue; } // TABLE name
      if (section === 'TABLES' && table === 'LAYER' && entity === 'LAYER' && hasLayers && layerRenames[v]) {
        out[i + 1] = layerRenames[v];
      } else if (section === 'BLOCKS' && entity === 'BLOCK' && hasBlocks && blockRenames[v]) {
        out[i + 1] = blockRenames[v];
      } else if (section === 'ENTITIES' && entity === 'INSERT' && hasBlocks && blockRenames[v]) {
        out[i + 1] = blockRenames[v];
      }
      continue;
    }
    if (code === '3' && section === 'BLOCKS' && entity === 'BLOCK' && hasBlocks && blockRenames[v]) {
      // BLOCK records repeat the name at group code 3 — keep it in sync.
      out[i + 1] = blockRenames[v];
      continue;
    }
    if (code === '8' && hasLayers && (section === 'ENTITIES' || section === 'BLOCKS') && layerRenames[v]) {
      out[i + 1] = layerRenames[v];
    }
  }
  return out.join('\n');
};

