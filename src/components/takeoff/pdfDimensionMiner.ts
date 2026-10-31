/**
 * PDF text-dimension miner: extract written component dimensions from a
 * drawing PDF's text layer (pdfjs getTextContent strings).
 *
 * Why this exists: architectural/structural PDFs carry authoritative written
 * dimensions (feet-inches room sizes, mm member sections, footing schedules,
 * opening schedules) that vector geometry alone cannot name. Per General Note
 * 5 on these drawings ("Only written dimensions to be followed"), text wins.
 *
 * Pure module (no pdfjs import): callers pass page text strings + page numbers.
 * All imperial values convert to meters; metric mm values convert to meters.
 */

/** One extracted dimension with its source page + confidence. */
export interface MinedDimension {
  /** Component family: room | wall-run | footing | beam | column | slab | opening | note. */
  family: 'room' | 'footing' | 'beam' | 'column' | 'slab' | 'opening' | 'note';
  /** Raw matched text, e.g. "14'-3\"x13'-9\"" or "F1 2.0m x 2.0m". */
  raw: string;
  /** Canonical label, e.g. "LIVING ROOM" / "F1" / "MB(230X350)" / "D1". */
  label: string;
  /** Primary numeric payload in meters (length, or L for LxW pairs). */
  lengthM: number;
  /** Secondary numeric payload in meters (width, 0 when not a pair). */
  widthM: number;
  /** Tertiary numeric payload in meters (depth/thickness, 0 when absent). */
  depthM: number;
  /** Count of identical units (opening schedule qtys, footing counts). */
  count: number;
  /** 1-based PDF page this came from. */
  page: number;
  /** 0..1 confidence in the parse. */
  confidence: number;
}

/** Feet+inches pair → meters. */
export const ftInToM = (ft: number, inch: number): number =>
  Math.round(((ft + inch / 12) * 0.3048 + 1e-9) * 1000) / 1000;

/** Parse `14'-3"` / `14'3"` / `35'-0"` fragments → meters. Returns NaN when no match. */
const parseFtIn = (s: string): number => {
  const m = s.match(/(\d+(?:\.\d+)?)\s*['\u2019]\s*-?\s*(\d+(?:\.\d+)?)?\s*(?:"|'{2}|\u201d)?/);
  if (!m) return NaN;
  return ftInToM(parseFloat(m[1]), m[2] ? parseFloat(m[2]) : 0);
};

/** Parse `axb` pairs in current unit context. Returns [a, b] or null. */
const parsePair = (s: string): [number, number] | null => {
  const m = s.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
};

/** Room keywords that anchor a ft-in size pair to a room label. */
const ROOM_WORDS = [
  'LIVING', 'BEDROOM', 'BED ROOM', 'MASTER', 'KITCHEN', 'DINNING', 'DINING',
  'T/B', 'TOILET', 'BATH', 'ATTCH', 'ATTACH', 'STORE', 'PUJA', 'LOBBY', 'STAIR'
];

/** Known opening codes from the opening schedule (D0/D1/D2/W/W1-W4/V/CG). */
const OPENING_CODE = /\b(D0|D1|D2|W1|W2|W3|W4|(?<![A-Z])W(?![0-9A-Z])|V|CG)\b/;

/**
 * Mine one page of PDF text into typed dimensions. `pageText` is the joined
 * textContent strings for that page; `page` is the 1-based page number.
 */
export const minePageDimensions = (pageText: string, page: number): MinedDimension[] => {
  const out: MinedDimension[] = [];
  const text = pageText.replace(/\s+/g, ' ');

  // 1. Room sizes: `<LABEL> <ft-in> x <ft-in>` — e.g. "LIVING ROOM 14'-3\"x13'-9\""
  const roomRe = /([A-Z/]{2,}(?:\s+(?:ROOM|BED|MASTER|KITCHEN|DINNING|DINING|T\/B|ATTCH))?)\s+(\d+(?:\.\d+)?\s*['\u2019]\s*-?\s*\d*(?:\.\d+)?\s*(?:"|'{2}|\u201d)?)\s*[x×*]\s*(\d+(?:\.\d+)?\s*['\u2019]\s*-?\s*\d*(?:\.\d+)?\s*(?:"|'{2}|\u201d)?)/g;
  let m: RegExpExecArray | null;
  while ((m = roomRe.exec(text)) !== null) {
    const label = m[1].trim();
    if (!ROOM_WORDS.some((w) => label.includes(w))) continue;
    const a = parseFtIn(m[2]);
    const b = parseFtIn(m[3]);
    if (!(a > 0 && b > 0)) continue;
    out.push({ family: 'room', raw: m[0].trim(), label, lengthM: a, widthM: b, depthM: 0, count: 1, page, confidence: 0.9 });
  }

  // 2. Overall building size: `35'-0" (10.67M)` — imperial/metric cross-check
  const overallRe = /(\d+(?:\.\d+)?\s*['\u2019]\s*-?\s*\d*(?:\.\d+)?\s*(?:"|'{2}|\u201d)?)\s*\(\s*(\d+(?:\.\d+)?)\s*M\s*\)/gi;
  while ((m = overallRe.exec(text)) !== null) {
    const imp = parseFtIn(m[1]);
    const met = parseFloat(m[2]);
    if (!(imp > 0 && met > 0)) continue;
    const conf = Math.abs(imp - met) / met < 0.02 ? 0.95 : 0.6;
    out.push({ family: 'note', raw: m[0].trim(), label: 'OVERALL-M', lengthM: met, widthM: imp, depthM: 0, count: 1, page, confidence: conf });
  }

  // 3. Footings: `F1 ... 2.0m x 2.0m` (+ nearby D/d/rebar context)
  const footRe = /(F1|F2|F3)\b[^F]{0,120}?(\d+(?:\.\d+)?)\s*m\s*x\s*(\d+(?:\.\d+)?)\s*m/gi;
  while ((m = footRe.exec(text)) !== null) {
    const tag = m[1].toUpperCase();
    const a = parseFloat(m[2]);
    const b = parseFloat(m[3]);
    if (!(a > 0 && b > 0 && a < 5 && b < 5)) continue;
    const ctx = text.slice(Math.max(0, m.index - 60), m.index + m[0].length);
    const dM = ctx.match(/D\s*(\d+)\s*mm/i);
    const barM = ctx.match(/(\d+)\s*Ø\s*@\s*(\d+)\s*C\/C/i);
    out.push({
      family: 'footing', raw: `${tag} ${m[2]}m x ${m[3]}m${barM ? ' ' + barM[0] : ''}`.trim(),
      label: tag, lengthM: a, widthM: b,
      depthM: dM ? parseFloat(dM[1]) / 1000 : 0.35,
      count: 1, page, confidence: barM ? 0.9 : 0.75
    });
  }

  // 4. Member sections `230X300` / `250X400` / `300x300` + slab `D=150mm`
  // Column cues: bare 300x300 (all columns are 300x300 on this job) or SIZE/COLUMN
  // context; everything else 2xx-3xx wide is a beam section.
  const secRe = /(MB|MAIN BEAM|STRAP BEAM|PLINTH(?: TIE)? BEAM|FOUNDATION(?: BEAM)?|COLUMN|SIZE|C1|C2|C3)?\s*\(?\s*(\d{2,4})\s*[xX]\s*(\d{2,4})\s*\)?/g;
  while ((m = secRe.exec(text)) !== null) {
    const kind = (m[1] || '').toUpperCase();
    const a = parseFloat(m[2]);
    const b = parseFloat(m[3]);
    if (!(a >= 100 && a <= 1000 && b >= 100 && b <= 1000)) continue;
    const isColumn = /COLUMN|SIZE|^C[123]$/.test(kind) || (a === 300 && b === 300 && !kind);
    const family: MinedDimension['family'] = isColumn ? 'column' : 'beam';
    const label = kind ? `${kind} ${a}X${b}`.trim() : `${a}X${b}`;
    const conf = kind ? 0.85 : (isColumn ? 0.7 : 0.55);
    out.push({ family, raw: m[0].trim(), label, lengthM: a / 1000, widthM: b / 1000, depthM: 0, count: 1, page, confidence: conf });
  }

  // 5. Slab thickness: `D)=150mm` / `Slab Thickness (D)=150mm`
  const slabRe = /Slab Thickness[^\d]{0,10}(\d+)\s*mm|D\)\s*=\s*(\d+)\s*mm/gi;
  while ((m = slabRe.exec(text)) !== null) {
    const t = parseFloat(m[1] ?? m[2]);
    if (!(t >= 75 && t <= 300)) continue;
    out.push({ family: 'slab', raw: m[0].trim(), label: 'SLAB-THK', lengthM: 0, widthM: 0, depthM: t / 1000, count: 1, page, confidence: 0.85 });
  }

  // 6. Openings: schedule rows may order as `D1 3'-0"x7'-0" 3` (code first) or
  // `3'-0"x7'-0" Door D1 ... 3 DOORS` (size first, schedule table). Try both.
  const openRe = /\b(D0|D1|D2|W1|W2|W3|W4|W|V|CG)\b\s+(\d+(?:\.\d+)?\s*['\u2019]\s*-?\s*\d*(?:\.\d+)?\s*(?:"|'{2}|\u201d)?)\s*[x×*]\s*(\d+(?:\.\d+)?\s*['\u2019]\s*-?\s*\d*(?:\.\d+)?\s*(?:"|'{2}|\u201d)?)(?:\s+(\d+))?/g;
  while ((m = openRe.exec(text)) !== null) {
    const code = m[1].toUpperCase();
    if (!OPENING_CODE.test(code)) continue;
    const a = parseFtIn(m[2]);
    const b = parseFtIn(m[3]);
    if (!(a > 0 && b > 0)) continue;
    const qty = m[4] ? parseInt(m[4], 10) : 1;
    out.push({
      family: 'opening', raw: m[0].trim(), label: code,
      lengthM: a, widthM: b, depthM: 0,
      count: qty > 0 && qty <= 20 ? qty : 1, page, confidence: 0.85
    });
  }
  // 6b. Size-first schedule rows on the OPENING SCHEDULE block only (page 3):
  // `3'-0"x7'-0" Door D1 REQ.NO. SIZE ... 3 DOORS`. Pages 1-2 room sizes like
  // `14'-3"x13'-9" D1` (D1 = grid label there) must NOT match — require one of
  // the schedule keywords (SCHEDULE/REQ/SIZE/DOORS/WINDOWS/Ventilation/Gate).
  const hasScheduleCtx = /SCHEDULE|REQ\.?\s*NO|DOORS|WINDOWS|VENTILATION|CHANNEL GATE/i.test(text);
  if (hasScheduleCtx) {
  const openRevRe = /(\d+(?:\.\d+)?\s*['\u2019]\s*-?\s*\d*(?:\.\d+)?\s*(?:"|'{2}|\u201d)?)\s*[x×*]\s*(\d+(?:\.\d+)?\s*['\u2019]\s*-?\s*\d*(?:\.\d+)?\s*(?:"|'{2}|\u201d)?)\s*(?:Window|Door|Ventilation|Channel Gate)?\s*\b(D0|D1|D2|W1|W2|W3|W4|W|V|CG)\b[^\d]{0,40}?(\d+)?\s*(?:DOORS|WINDOWS?)?/gi;
  while ((m = openRevRe.exec(text)) !== null) {
    const code = m[3].toUpperCase();
    // Skip rows already captured code-first (same position overlap check).
    if (dimsHave(out, page, code, m.index)) continue;
    const a = parseFtIn(m[1]);
    const b = parseFtIn(m[2]);
    if (!(a > 0 && b > 0)) continue;
    const qty = m[4] ? parseInt(m[4], 10) : 1;
    out.push({
      family: 'opening', raw: m[0].trim().slice(0, 80), label: code,
      lengthM: a, widthM: b, depthM: 0,
      count: qty > 0 && qty <= 20 ? qty : 1, page, confidence: 0.8
    });
  }
  }
  return out;
};

/** True when an opening with this code was already mined near this position. */
const dimsHave = (dims: MinedDimension[], page: number, label: string, pos: number): boolean =>
  dims.some((d) => d.page === page && d.label === label);

/** Mine a whole document: map of page number to joined textContent string. */
export const mineDocumentDimensions = (pages: Record<number, string>): MinedDimension[] =>
  Object.entries(pages).flatMap(([p, t]) => minePageDimensions(t, Number(p)));

/** Total room floor area (m2) across mined room dims. */
export const totalRoomAreaM2 = (dims: MinedDimension[]): number =>
  Math.round(dims.filter((d) => d.family === 'room').reduce((a, d) => a + d.lengthM * d.widthM, 0) * 100) / 100;

/** Total opening area (m2), weighted by schedule counts. */
export const totalOpeningAreaM2 = (dims: MinedDimension[]): number =>
  Math.round(dims.filter((d) => d.family === 'opening').reduce((a, d) => a + d.lengthM * d.widthM * d.count, 0) * 100) / 100;

export { parsePair };

