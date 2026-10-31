import { MaterialRate, MeasurementCategory, Project, SubDivisionLine } from '../../App';
import { CanvasPoint, VisualMeasurement } from '../BlueprintCanvasOverlay';

/**
 * Pure geometry + take-off math for the Take-Off Blueprint tab.
 * Kept free of React so it can be reasoned about (and reused) independently
 * of the canvas component.
 */

/** Pixel distance between two canvas points (image space, already de-panned/de-zoomed). */
export const pixelDistance = (p1: CanvasPoint, p2: CanvasPoint): number =>
  Math.hypot(p2.x - p1.x, p2.y - p1.y);

/** Distance in real-world meters at the given scale. */
export const distanceMeters = (p1: CanvasPoint, p2: CanvasPoint, pixelsPerMeter: number): number => {
  if (pixelsPerMeter <= 0) return 0;
  return Number((pixelDistance(p1, p2) / pixelsPerMeter).toFixed(2));
};

/** Sum of segment lengths along a polyline, in meters. */
export const polylineLengthMeters = (points: CanvasPoint[], pixelsPerMeter: number): number => {
  if (points.length < 2 || pixelsPerMeter <= 0) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += pixelDistance(points[i], points[i + 1]) / pixelsPerMeter;
  }
  return Number(total.toFixed(2));
};

/** Shoelace polygon area in square meters. */
export const polygonAreaMeters = (points: CanvasPoint[], pixelsPerMeter: number): number => {
  if (points.length < 3 || pixelsPerMeter <= 0) return 0;
  let areaPixels = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    areaPixels += points[i].x * points[j].y;
    areaPixels -= points[j].x * points[i].y;
  }
  areaPixels = Math.abs(areaPixels) / 2;
  return Number((areaPixels / (pixelsPerMeter * pixelsPerMeter)).toFixed(2));
};

/** Closed-loop perimeter of a polygon, in meters. */
export const polygonPerimeterMeters = (points: CanvasPoint[], pixelsPerMeter: number): number => {
  if (points.length < 3 || pixelsPerMeter <= 0) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    total += pixelDistance(points[i], points[j]) / pixelsPerMeter;
  }
  return Number(total.toFixed(2));
};

/** Rectangular bounds of a set of points. */
export const pointBounds = (points: CanvasPoint[]) => {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

/**
 * Re-derive a measurement's length/area from its points at the current scale.
 * Used after vertex edits and after recalibration so stored values stay truthful.
 * Returns a NEW measurement object; does not mutate.
 */
export const recomputeMeasurement = (
  meas: VisualMeasurement,
  pixelsPerMeter: number
): VisualMeasurement => {
  if (meas.type === 'line') {
    return { ...meas, lengthMeters: polylineLengthMeters(meas.points, pixelsPerMeter) };
  }
  return {
    ...meas,
    lengthMeters: polygonPerimeterMeters(meas.points, pixelsPerMeter),
    areaMetersSquared: polygonAreaMeters(meas.points, pixelsPerMeter)
  };
};

/** Recompute an entire measurement list against a (possibly new) scale. */
export const recomputeAll = (
  list: VisualMeasurement[],
  pixelsPerMeter: number
): VisualMeasurement[] => list.map(m => recomputeMeasurement(m, pixelsPerMeter));

/**
 * Constrain a candidate point so the segment coming from `anchor` stays locked
 * to the nearest 45-degree increment (orthogonal drawing).
 */
export const constrain45 = (anchor: CanvasPoint, candidate: CanvasPoint): CanvasPoint => {
  const dx = candidate.x - anchor.x;
  const dy = candidate.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return candidate;

  // Snap the vector to the closest multiple of 45deg.
  const step = Math.PI / 4;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / step) * step;
  return {
    x: anchor.x + Math.cos(snapped) * len,
    y: anchor.y + Math.sin(snapped) * len
  };
};

/**
 * Distance from `p` to the segment `a`->`b`, in canvas pixels.
 * Used for edge hit-testing (alt-click to insert a vertex).
 */
export const pointToSegmentDistance = (
  p: CanvasPoint,
  a: CanvasPoint,
  b: CanvasPoint
): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return pixelDistance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/**
 * Resolve the final BOQ dimensions/unit/description for a measurement.
 * Single source of truth shared by both standalone BOQ items and subdivision rows.
 */
export const resolveTakeoffDims = (meas: VisualMeasurement, project: Project) => {
  let finalUnit: 'm' | 'm²' | 'm³' = meas.targetUnit;
  let finalLength = meas.lengthMeters;
  let finalWidth = 1;
  let finalHeight = 1;
  let description = `[Visual Takeoff] ${meas.name}`;

  if (meas.targetUnit === 'm³') {
    if (meas.type === 'line') {
      // Wall Volume: Length * Thickness * Height
      finalLength = meas.lengthMeters;
      finalWidth = meas.widthThickness || 0.23;
      finalHeight = meas.heightOrThickness || project.standardWallHeight;
      description += ` (L: ${finalLength}m × W: ${finalWidth}m × H: ${finalHeight}m)`;
    } else {
      // Slab / Excavation Volume: Area * Thickness
      finalLength = meas.areaMetersSquared || 1;
      finalWidth = 1;
      finalHeight = meas.heightOrThickness || 0.15;
      description += ` (Area: ${meas.areaMetersSquared}m² × Depth: ${finalHeight}m)`;
    }
  } else if (meas.targetUnit === 'm²') {
    finalLength = meas.areaMetersSquared || (meas.lengthMeters * (meas.heightOrThickness || 1));
    finalWidth = 1;
    finalHeight = 1;
    description += ` (Area: ${meas.areaMetersSquared || meas.lengthMeters}m²)`;
  } else {
    // Length 'm'
    finalLength = meas.lengthMeters;
    finalWidth = 1;
    finalHeight = 1;
    description += ` (Linear: ${meas.lengthMeters}m)`;
  }
  return { finalUnit, finalLength, finalWidth, finalHeight, description };
};

/** Build the subdivision row for a measurement (identical math to BOQ items). */
export const buildSubLineFromMeasurement = (
  meas: VisualMeasurement,
  project: Project
): SubDivisionLine => {
  const dims = resolveTakeoffDims(meas, project);
  return {
    id: 'sub-vis-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    description: dims.description,
    qty: 1,
    length: dims.finalLength,
    width: dims.finalWidth,
    height: dims.finalHeight
  };
};

/** A measurement drawn as a wall volume (linear masonry/RCC run). */
export const isWallMeasurement = (meas: VisualMeasurement): boolean =>
  meas.targetUnit === 'm³' && meas.type === 'line';

/**
 * Identify opening measurements (doors / windows) drawn on the canvas.
 * On the freeform canvas there are no layer/block names, so openings are the
 * Finishing-category shapes that carry a measurable area (drawn with the
 * rectangle / polygon tool). Returns their total clear area in m².
 */
export const openingAreaFromMeasurements = (measurements: VisualMeasurement[]): number => {
  return measurements.reduce((sum, m) => {
    const area = m.areaMetersSquared;
    const isOpening =
      m.category === 'Finishing' &&
      typeof area === 'number' &&
      area > 0;
    return isOpening ? sum + (area as number) : sum;
  }, 0);
};

/**
 * Per-wall opening deduction (m²) so the total deducted across all wall runs
 * equals the total drawn opening area — no over- or under-deduction when a plan
 * has several wall segments. The wall BOQ math multiplies this area by the wall
 * thickness to obtain the deducted volume (see calculateItemQuantity).
 */
export const perWallOpeningDeduction = (measurements: VisualMeasurement[]): number => {
  const wallCount = measurements.filter(isWallMeasurement).length;
  if (wallCount === 0) return 0;
  const totalOpening = openingAreaFromMeasurements(measurements);
  return totalOpening > 0 ? totalOpening / wallCount : 0;
};


/**
 * Pick a sensible default unit rate from the project's Material library.
 * Falls back to 0 (never a hardcoded currency amount) so the user is never
 * silently billed in a currency they did not choose.
 */
export const getDefaultRateForCategory = (
  category: MeasurementCategory,
  materials: MaterialRate[]
): number => {
  const match = materials.find(
    m => m.category === category && typeof m.rate === 'number' && m.rate > 0
  );
  return match ? match.rate : 0;
};

/** Same idea, but prefers the measurement's own stored rate when present. */
export const resolveRate = (
  meas: VisualMeasurement,
  category: MeasurementCategory,
  materials: MaterialRate[]
): number => {
  if (typeof meas.unitRate === 'number' && meas.unitRate > 0) return meas.unitRate;
  return getDefaultRateForCategory(category, materials);
};

/** Categories represented in a measurement list (drives the filter chips). */
export const usedCategories = (list: VisualMeasurement[]): MeasurementCategory[] => {
  const seen = new Set<MeasurementCategory>();
  list.forEach(m => seen.add(m.category));
  return Array.from(seen);
};


