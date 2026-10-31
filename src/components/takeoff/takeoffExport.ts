import { MaterialRate, Project } from '../../App';
import { VisualMeasurement } from '../BlueprintCanvasOverlay';
import { resolveTakeoffDims, resolveRate } from './takeoffGeometry';

/**
 * CSV / JSON export for the Take-Off Blueprint tab.
 * Uses the same Blob + URL.createObjectURL pattern already established in
 * App.tsx for the DXF template download.
 */

const csvEscape = (value: string | number): string => {
  const s = String(value ?? '');
  // Quote when the value contains a delimiter, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export interface ExportRow {
  name: string;
  type: string;
  category: string;
  unit: string;
  quantity: number;
  length: number;
  width: number;
  height: number;
  linearMeters: number;
  areaSqMeters: number;
  unitRate: number;
  status: string;
}

/** Flatten measurements into export rows using the BOQ dimension resolver. */
export const buildExportRows = (
  measurements: VisualMeasurement[],
  project: Project,
  materials: MaterialRate[]
): ExportRow[] =>
  measurements.map(meas => {
    const dims = resolveTakeoffDims(meas, project);
    return {
      name: meas.name,
      type: meas.type,
      category: meas.category,
      unit: dims.finalUnit,
      quantity: 1,
      length: dims.finalLength,
      width: dims.finalWidth,
      height: dims.finalHeight,
      linearMeters: meas.lengthMeters,
      areaSqMeters: meas.areaMetersSquared ?? 0,
      unitRate: resolveRate(meas, meas.category, materials),
      status: meas.isSavedToBOQ ? 'In BOQ' : 'Draft'
    };
  });

export const buildCsv = (rows: ExportRow[]): string => {
  const header = [
    'Name',
    'Type',
    'Category',
    'Unit',
    'Quantity',
    'Length (m)',
    'Width (m)',
    'Height (m)',
    'Linear Length (m)',
    'Area (m2)',
    'Unit Rate',
    'Status'
  ];
  const lines = rows.map(r =>
    [
      r.name,
      r.type,
      r.category,
      r.unit,
      r.quantity,
      r.length,
      r.width,
      r.height,
      r.linearMeters,
      r.areaSqMeters,
      r.unitRate,
      r.status
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.map(csvEscape).join(','), ...lines].join('\r\n');
};

/** Trigger a browser download of `content` with the given filename. */
const download = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const safeProjectName = (project: Project): string =>
  (project.name || 'takeoff')
    .trim()
    .replace(/[^\w\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'takeoff';

/** Export the take-off sheet as CSV. Returns the filename that was written. */
export const exportTakeoffCsv = (
  measurements: VisualMeasurement[],
  project: Project,
  materials: MaterialRate[]
): string => {
  const filename = `${safeProjectName(project)}_takeoff_${new Date().toISOString().slice(0, 10)}.csv`;
  download('\uFEFF' + buildCsv(buildExportRows(measurements, project, materials)), filename, 'text/csv;charset=utf-8');
  return filename;
};

/**
 * Export the take-off sheet as JSON (round-trippable: includes scale and the
 * raw geometry, so it can be re-imported later).
 */
export const exportTakeoffJson = (
  measurements: VisualMeasurement[],
  project: Project,
  pixelsPerMeter: number,
  activeFileName: string
): string => {
  const filename = `${safeProjectName(project)}_takeoff_${new Date().toISOString().slice(0, 10)}.json`;
  const payload = {
    format: 'structest-takeoff',
    version: 1,
    exportedAt: new Date().toISOString(),
    projectId: project.id,
    projectName: project.name,
    pixelsPerMeter,
    sourceFile: activeFileName,
    measurements
  };
  download(JSON.stringify(payload, null, 2), filename, 'application/json');
  return filename;
};
