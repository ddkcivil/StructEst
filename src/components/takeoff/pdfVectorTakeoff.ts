/**
 * Vector-PDF take-off: reconstruct measurable geometry from a PDF's operator
 * list and run it through the SAME component-extraction pipeline the DXF tab
 * uses (extractComponents → buildStandardBoqFromExtraction, i.e. measurement-
 * sheet lines that aggregate into the standard 23-item BOQ). This turns a
 * vector PDF into an
 * automatic take-off instead of forcing the user to measure a flattened bitmap
 * by hand.
 *
 * Reality check for PDFs vs DXF:
 *  - A PDF has no layer names and no INSERT blocks, so the DXF keyword/block
 *    rules cannot match by name. We instead CLASSIFY each reconstructed polyline
 *    by its geometry (closed vs open, footprint area, length) and stamp a
 *    synthetic layer that the existing DEFAULT_RULES already understand:
 *      long open run      → A-WALL-EXT   (wall, length)
 *      closed large area  → S-SLAB       (area)
 *      closed small area  → S-COLS       (column footprint, area)
 *  - A PDF carries no real-world scale ($INSUNITS equivalent). We need a
 *    points->meters factor, supplied by the caller (detected/known plot scale);
 *    when unknown we still return geometry and let the caller flag it.
 *
 * This module is pure (no pdfjs import) so the path reconstruction and matrix
 * math are unit-testable with a synthetic operator list.
 */

import {
  extractComponents,
  type DxfExtraction,
  type DxfExtractionOptions
} from './dxfTakeoff';

// ---- Operator-list constants (pdfjs-dist v6 OPS map) ----------------------
const OPS = {
  setLineWidth: 2,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  closePath: 18,
  rectangle: 19,
  constructPath: 91
} as const;

// DrawOPS sub-opcodes used inside a constructPath's flat data array.
const DRAW = {
  moveTo: 0,
  lineTo: 1,
  curveTo: 2,
  quadraticCurveTo: 3,
  closePath: 4
} as const;

export interface VecPoint { x: number; y: number }

/** A reconstructed subpath (one moveTo..., possibly closed). */
export interface VecPath {
  points: VecPoint[];
  closed: boolean;
  /** Geometric length in PDF point-space units (pre-scale). */
  length: number;
  /** Shoelace area (absolute) if closed, else 0. */
  area: number;
  /** Axis-aligned bounding box of the points. */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Minimal shape of the object returned by page.getOperatorList(). */
export interface OperatorList {
  fnArray: number[];
  argsArray: any[];
}

// ---- Affine matrix helpers ------------------------------------------------
// PDF CTM is [a b c d e f] meaning:
//   x' = a*x + c*y + e
//   y' = b*x + d*y + f
type Ctm = [number, number, number, number, number, number];
const IDENTITY: Ctm = [1, 0, 0, 1, 0, 0];

const applyCtm = (m: Ctm, x: number, y: number): VecPoint => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5]
});

/** Compose two affine matrices: result = m1 ∘ m2 (apply m2 first, then m1). */
const mulCtm = (m1: Ctm, m2: Ctm): Ctm => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
];

const segLen = (a: VecPoint, b: VecPoint) => Math.hypot(b.x - a.x, b.y - a.y);

const shoelace = (pts: VecPoint[]): number => {
  if (pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
};

const bboxOf = (pts: VecPoint[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

/**
 * Reconstruct all polyline subpaths from a pdfjs operator list. Applies the
 * accumulated CTM (from `transform` ops) and an optional base transform (the
 * page viewport transform) so coordinates come out in a consistent space.
 * Curves are flattened to their endpoints (good enough for straight-edged
 * architectural geometry like walls/rooms).
 */
export const reconstructPaths = (
  opList: OperatorList,
  baseTransform?: Ctm
): VecPath[] => {
  const { fnArray = [], argsArray = [] } = opList || {};
  let ctm: Ctm = baseTransform ? [...baseTransform] as Ctm : [...IDENTITY] as Ctm;
  const paths: VecPath[] = [];

  // Builder for the subpath currently being assembled.
  let cur: VecPoint[] = [];
  let curClosed = false;
  let hasContent = false;

  const flush = () => {
    if (!hasContent) return;
    const pts = cur.slice();
    if (pts.length >= 2) {
      const length = pts.reduce((acc, p, i) => (i === 0 ? 0 : acc + segLen(pts[i - 1], p)), 0);
      const closedLen = curClosed && pts.length > 2 ? segLen(pts[pts.length - 1], pts[0]) : 0;
      paths.push({
        points: pts,
        closed: curClosed,
        length: length + closedLen,
        area: curClosed ? shoelace(pts) : 0,
        bbox: bboxOf(pts)
      });
    }
    cur = [];
    curClosed = false;
    hasContent = false;
  };

  const addPoint = (x: number, y: number) => {
    cur.push(applyCtm(ctm, x, y));
    hasContent = true;
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];
    switch (fn) {
      case OPS.transform: {
        // [a b c d e f] — compose onto the running CTM.
        if (Array.isArray(args) && args.length >= 6) {
          ctm = mulCtm(ctm, [args[0], args[1], args[2], args[3], args[4], args[5]]);
        }
        break;
      }
      case OPS.constructPath: {
        // pdfjs ≤v4: args = [drawOpsFlat, minMax] — flat DrawOPS number stream.
        // pdfjs v6:  args = [paintOp, segments, bbox] where segments is an array
        //            of Float32Array, each holding [op, x, y] triples using the
        //            same DRAW opcodes below (op 4 = closePath: only 1 number).
        const segs = Array.isArray(args) && args.length === 3 ? args[1] : null;
        if (Array.isArray(segs) && segs.length > 0 && segs[0] != null && typeof segs[0].length === 'number') {
          for (const seg of segs) {
            const arr: ArrayLike<number> = seg as ArrayLike<number>;
            for (let k = 0; k < arr.length;) {
              const d = arr[k++];
              if (d === DRAW.moveTo) {
                if (hasContent) flush();
                addPoint(arr[k++], arr[k++]);
              } else if (d === DRAW.lineTo) {
                addPoint(arr[k++], arr[k++]);
              } else if (d === DRAW.curveTo) {
                k += 4; // cubic: 6 numbers, use endpoint only
                addPoint(arr[k++], arr[k++]);
              } else if (d === DRAW.quadraticCurveTo) {
                k += 2; // quadratic: 4 numbers, endpoint
                addPoint(arr[k++], arr[k++]);
              } else if (d === DRAW.closePath) {
                curClosed = true;
              } else {
                break; // Unknown DrawOPS — stop this segment defensively.
              }
            }
          }
          break;
        }
        const data = Array.isArray(args) ? args[0] : null;
        if (!Array.isArray(data)) break;
        for (let k = 0; k < data.length;) {
          const d = data[k++];
          if (d === DRAW.moveTo) {
            if (hasContent) flush();
            addPoint(data[k++], data[k++]);
          } else if (d === DRAW.lineTo) {
            addPoint(data[k++], data[k++]);
          } else if (d === DRAW.curveTo) {
            k += 4; // cubic: 6 numbers, use endpoint only
            addPoint(data[k++], data[k++]);
          } else if (d === DRAW.quadraticCurveTo) {
            k += 2; // quadratic: 4 numbers, endpoint
            addPoint(data[k++], data[k++]);
          } else if (d === DRAW.closePath) {
            curClosed = true;
          } else {
            break; // Unknown DrawOPS — stop parsing this constructPath defensively.
          }
        }
        break;
      }
      case OPS.rectangle: {
        if (hasContent) flush();
        const [x, y, w, h] = args as [number, number, number, number];
        addPoint(x, y);
        addPoint(x + w, y);
        addPoint(x + w, y + h);
        addPoint(x, y + h);
        curClosed = true;
        break;
      }
      case OPS.moveTo: {
        if (hasContent) flush();
        addPoint(args[0], args[1]);
        break;
      }
      case OPS.lineTo: {
        addPoint(args[0], args[1]);
        break;
      }
      case OPS.closePath: {
        curClosed = true;
        break;
      }
      default:
        break;
    }
  }
  flush();
  return paths;
};

// ---- Geometry → DXF-like entities -----------------------------------------

export interface PdfEntity {
  type: 'LINE' | 'LWPOLYLINE';
  layer: string;
  vertices: VecPoint[];
  shape?: boolean;
}

export interface ClassifyOptions {
  /** Closed shapes with area >= this (point-space units²) become slabs/rooms. */
  areaThreshold?: number;
  /** Open paths at least this long (point-space units) become wall runs. */
  minWallLength?: number;
}

/**
 * Classify reconstructed PDF paths into synthetic-layer DXF-like entities the
 * existing DEFAULT_RULES understand. Heuristics (in point-space):
 *  - open & long            → A-WALL-EXT   (wall, length)
 *  - closed & large area    → S-SLAB       (area)
 *  - closed & small area    → S-COLS       (column footprint, area)
 * Tiny/degenerate paths are dropped as noise (hatching, ticks, title-block).
 */
export const classifyPathsToEntities = (
  paths: VecPath[],
  options: ClassifyOptions = {}
): PdfEntity[] => {
  const areaThreshold = options.areaThreshold ?? 4000;
  const minWallLength = options.minWallLength ?? 12;
  const out: PdfEntity[] = [];

  for (const p of paths) {
    const diag = Math.hypot(p.bbox.maxX - p.bbox.minX, p.bbox.maxY - p.bbox.minY);
    if (diag < 2) continue; // skip near-invisible noise

    if (p.closed && p.area >= areaThreshold) {
      out.push({ type: 'LWPOLYLINE', layer: 'S-SLAB', vertices: p.points, shape: true });
    } else if (p.closed) {
      out.push({ type: 'LWPOLYLINE', layer: 'S-COLS', vertices: p.points, shape: true });
    } else if (p.length >= minWallLength) {
      out.push({ type: 'LWPOLYLINE', layer: 'A-WALL-EXT', vertices: p.points });
    }
  }
  return out;
};

// ---- Full extraction (page operator list → DxfExtraction) -----------------

export interface PdfExtractionOptions extends DxfExtractionOptions, ClassifyOptions {
  /** Meters per one PDF point-space unit (from a known/detected plot scale). */
  pointsPerMeter?: number;
  /** Page viewport transform [a b c d e f] to map into screen/canvas space. */
  baseTransform?: Ctm;
}

/**
 * Reconstruct + classify a PDF page's vector geometry, then run it through the
 * shared extractComponents() so callers get the exact same DxfExtraction shape
 * as the DXF tab. Geometry is authored in METERS (point coords divided by
 * pointsPerMeter) and unit is forced to 'meters', so the shared pipeline is
 * exact regardless of the PDF's native point units.
 */
export const extractFromOperatorList = (
  opList: OperatorList,
  options: PdfExtractionOptions = {}
): DxfExtraction => {
  const ppm = options.pointsPerMeter && options.pointsPerMeter > 0 ? options.pointsPerMeter : 1;

  const paths = reconstructPaths(opList, options.baseTransform as Ctm | undefined);
  const rawEntities = classifyPathsToEntities(paths, options);

  const entities = rawEntities.map(e => ({
    type: e.type,
    layer: e.layer,
    shape: e.shape,
    vertices: e.vertices.map(v => ({ x: v.x / ppm, y: v.y / ppm }))
  }));

  return extractComponents({ entities, header: {} }, {
    ...options,
    unitOverride: 'meters'
  });
};

/** True when an operator list carries meaningful vector geometry to extract. */
export const hasVectorGeometry = (opList: OperatorList | null | undefined): boolean => {
  if (!opList || !Array.isArray(opList.fnArray)) return false;
  return opList.fnArray.some(fn => fn === OPS.constructPath || fn === OPS.rectangle);
};


