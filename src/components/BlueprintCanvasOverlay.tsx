import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Ruler,
  Square,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Check,
  Upload,
  MousePointer,
  Save,
  CheckCircle2,
  Sliders,
  X,
  FileText,
  Eye,
  EyeOff,
  Layers,
  ArrowRight,
  Copy,
  Download,
  Undo2,
  Redo2,
  Keyboard,
  Crosshair,
  MoveDiagonal,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  MaterialRate,
  MeasurementCategory,
  MeasurementItem,
  Project,
  SubDivisionLine,
  PREDEFINED_CATEGORIES,
  getCategoryBadgeClass
} from '../App';
import {
  buildSubLineFromMeasurement,
  constrain45,
  recomputeAll,
  recomputeMeasurement,
  resolveTakeoffDims,
  resolveRate,
  getDefaultRateForCategory,
  isWallMeasurement,
  perWallOpeningDeduction
} from './takeoff/takeoffGeometry';
import {
  clearTakeoffSession,
  loadTakeoffSession,
  saveTakeoffSession
} from './takeoff/takeoffStorage';
import { exportTakeoffCsv, exportTakeoffJson } from './takeoff/takeoffExport';
import { NBC_MEMBER_SIZES } from './takeoff/nbc205';
import { standardSnForMeasurement } from './takeoff/boqStandard';
import {
  reconstructPaths,
  classifyPathsToEntities,
  hasVectorGeometry,
  type VecPath
} from './takeoff/pdfVectorTakeoff';

/**
 * True when a keyboard event originated from a text-entry control, so global
 * shortcuts (Esc / L / P / R / C / S / Del / + / - / F) are ignored while the
 * user is typing into a field rather than drawing on the canvas.
 */
const isTextFieldTarget = (target: EventTarget | null): boolean => {
  const el = target as (HTMLElement & { isContentEditable?: boolean }) | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
};

/**
 * Ensure an SVG string has explicit pixel width/height so it renders when loaded
 * through an <img> element. Browsers treat a size-less SVG as 0×0, which is why
 * a valid-looking upload can silently produce a blank canvas. When the SVG has a
 * viewBox but no width/height we synthesize them from the viewBox; if it has
 * neither we fall back to a sensible default. Returns a base64 data URL.
 */
const injectSvgDimensions = (svgText: string): string => {
  const hasWidth = /\bwidth\s*=/.test(svgText);
  const hasHeight = /\bheight\s*=/.test(svgText);
  let out = svgText;

  if (!hasWidth || !hasHeight) {
    // Pull width/height from the viewBox when present.
    const vbMatch = svgText.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
    const vbW = vbMatch ? Math.max(1, Math.round(parseFloat(vbMatch[1]))) : 1024;
    const vbH = vbMatch ? Math.max(1, Math.round(parseFloat(vbMatch[2]))) : 1024;

    const wAttr = hasWidth ? '' : ` width="${vbW}"`;
    const hAttr = hasHeight ? '' : ` height="${vbH}"`;

    // Insert attributes right after the opening <svg ...> tag.
    out = svgText.replace(/<svg\b/i, (m) => `${m}${wAttr}${hAttr}`);
  }

  // UTF-8 safe base64 so accented text / metadata survive the round-trip.
  const b64 = btoa(unescape(encodeURIComponent(out)));
  return `data:image/svg+xml;base64,${b64}`;
};

// Setup pdfjs worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF worker setup:', e);
  }
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface VisualMeasurement {
  id: string;
  name: string;
  type: 'line' | 'polygon' | 'rectangle';
  points: CanvasPoint[];
  category: MeasurementCategory;
  // Computed values
  lengthMeters: number; // for line or polygon perimeter
  areaMetersSquared?: number; // for polygon or rectangle
  // Optional 3D takeoff parameters
  targetUnit: 'm' | 'm²' | 'm³';
  heightOrThickness?: number; // e.g. 3.0m wall height or 0.15m slab thickness
  widthThickness?: number; // e.g. 0.23m wall width
  unitRate?: number;
  color: string;
  isSavedToBOQ?: boolean;
  /** BOQ item this measurement created — lets a re-save UPDATE instead of duplicating. */
  boqItemId?: string;
  /** Subdivision line ids this measurement pushed under an existing BOQ item. */
  subLineIds?: string[];
  /** Canvas visibility toggle (eye icon in the measurements table). */
  isVisible?: boolean;
  /** Which PDF page the measurement was drawn on (multi-page drawings). */
  pdfPage?: number;
}

interface BlueprintCanvasOverlayProps {
  currentProject: Project;
  /** Unit rates from the Materials library, used for rate defaults (never hardcoded). */
  materials: MaterialRate[];
  onSaveItemToBOQ: (item: MeasurementItem) => void;
  onBatchSaveItemsToBOQ: (items: MeasurementItem[]) => void;
  /**
   * Update an existing BOQ item created by this take-off measurement.
   * Keeps "Update BOQ" from appending a duplicate row.
   */
  onUpdateItemToBOQ: (item: MeasurementItem) => void;
  /**
   * Route canvas take-off lines into the standard 23-item BOQ: each line carries
   * the standard S.N. it maps to. The app creates the standard item if absent
   * and appends the line as a measurement-sheet subdivision (never duplicates).
   */
  onSaveStandardLinesToBOQ?: (entries: { sn: number; line: SubDivisionLine }[]) => void;
  /** Optional: append take-off lines as subdivision rows under an existing BOQ item. */
  onSaveSubdivisionToBOQ?: (itemId: string, lines: SubDivisionLine[]) => void;
  /** Optional: replace previously-pushed subdivision rows (used by "Update BOQ"). */
  onUpdateSubdivisionsToBOQ?: (
    itemId: string,
    oldLineIds: string[],
    newLines: SubDivisionLine[]
  ) => void;
  initialFileName?: string | null;
  initialFilePreview?: string | null;
}

// Upload-only drawing intake — real blueprints/PDFs only, no sample drawings.

const MEASUREMENT_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316'  // orange
];

export const BlueprintCanvasOverlay: React.FC<BlueprintCanvasOverlayProps> = ({
  currentProject,
  materials,
  onSaveItemToBOQ,
  onBatchSaveItemsToBOQ,
  onUpdateItemToBOQ,
  onSaveStandardLinesToBOQ,
  onSaveSubdivisionToBOQ,
  onUpdateSubdivisionsToBOQ,
  initialFileName,
  initialFilePreview
}) => {
  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Background image state (starts empty — user uploads a real drawing/PDF)
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  // Data URL of the loaded drawing, so the session can be restored after reload
  const [backgroundImageSrc, setBackgroundImageSrc] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string>(initialFileName || 'No drawing loaded');
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);
  const pdfDocRef = useRef<any>(null);

  // Vector-PDF extraction: reconstructed geometry from the PDF operator list.
  // When present, the user can auto-generate measurements instead of drawing
  // every wall/room by hand. Null until a vector PDF page is parsed.
  const [pdfVectorPaths, setPdfVectorPaths] = useState<VecPath[] | null>(null);
  // Meters per one PDF point-space unit. Derived from the render scale (the page
  // was rendered at scale 1.5 and the default plot scale is 40 px/m) unless the
  // user re-calibrates; kept in sync with pixelsPerMeter via the ratio below.
  const [pdfPointsPerMeter, setPdfPointsPerMeter] = useState<number | null>(null);
  // Show the reconstructed vector geometry as a translucent on-canvas preview
  // (color-coded by what it will become) so the user can review before
  // committing it as measurements. On by default when vector paths are detected.
  const [showVectorPreview, setShowVectorPreview] = useState<boolean>(true);

  // Drawing state
  const [drawingMode, setDrawingMode] = useState<'select' | 'line' | 'polygon' | 'rectangle' | 'calibrate'>('polygon');
  const [currentPoints, setCurrentPoints] = useState<CanvasPoint[]>([]);
  const [mousePos, setMousePos] = useState<CanvasPoint | null>(null);
  const [measurements, setMeasurements] = useState<VisualMeasurement[]>([]);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Orthogonal / 45-degree constraint while drawing
  const [isOrthoLocked, setIsOrthoLocked] = useState<boolean>(false);

  // Vertex editing: dragging a handle of an existing measurement
  const [draggingVertex, setDraggingVertex] = useState<{ measId: string; index: number } | null>(null);

  // Undo / redo history of measurement snapshots
  const [historyPast, setHistoryPast] = useState<VisualMeasurement[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<VisualMeasurement[][]>([]);

  // Table filters & canvas readability
  const [categoryFilter, setCategoryFilter] = useState<'All' | MeasurementCategory>('All');

  // Fullscreen / expanded canvas
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState<boolean>(false);

  // Viewport Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calibration State (Scale in pixels per real-world meter)
  const [pixelsPerMeter, setPixelsPerMeter] = useState<number>(32); // default 32 px = 1 meter
  const [calibrationPoints, setCalibrationPoints] = useState<CanvasPoint[]>([]);
  const [isCalibrateModalOpen, setIsCalibrateModalOpen] = useState<boolean>(false);
  const [calibrationLengthInput, setCalibrationLengthInput] = useState<string>('5.0');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Quick form for selected measurement
  const [activeCategory, setActiveCategory] = useState<MeasurementCategory>('Superstructure');

  // Load image helper
  const loadImageFromSrc = (src: string, planScale?: number) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBackgroundImage(img);
      setBackgroundImageSrc(src);
      if (planScale) {
        setPixelsPerMeter(planScale);
      }
      fitImageToCanvas(img);
    };
    img.onerror = () => {
      console.error('Could not decode drawing source');
      alert('Could not decode this drawing. Try re-exporting it as a high-resolution PNG or JPG.');
    };
    img.src = src;
  };

  // Auto-fit image in container
  const fitImageToCanvas = (img: HTMLImageElement) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cWidth = rect.width || 800;
    const cHeight = rect.height || 500;

    const scaleX = (cWidth - 40) / img.naturalWidth;
    const scaleY = (cHeight - 40) / img.naturalHeight;
    const bestZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.5);

    setZoom(bestZoom);
    setPan({
      x: (cWidth - img.naturalWidth * bestZoom) / 2,
      y: (cHeight - img.naturalHeight * bestZoom) / 2
    });
  };

  /**
   * Single entry point for most mutations of the measurement list.
   * Snapshots the current list onto the undo stack so accidental deletes,
   * clear-alls and miscalibrated edits are always recoverable.
   */
  const commitMeasurements = useCallback(
    (
      updater: VisualMeasurement[] | ((prev: VisualMeasurement[]) => VisualMeasurement[]),
      options?: { history?: boolean }
    ) => {
      const recordHistory = options?.history !== false;
      setMeasurements(prev => {
        if (recordHistory) {
          setHistoryPast(past => [...past.slice(-49), prev]);
          setHistoryFuture([]);
        }
        return typeof updater === 'function'
          ? (updater as (prev: VisualMeasurement[]) => VisualMeasurement[])(prev)
          : updater;
      });
    },
    []
  );

  const measurementsRef = useRef<VisualMeasurement[]>(measurements);
  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

  const performUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryFuture(future => [...future.slice(-49), measurementsRef.current]);
    setHistoryPast(past => past.slice(0, -1));
    setMeasurements(previous);
    setSelectedMeasurementId(null);
  }, [historyPast]);

  const performRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[historyFuture.length - 1];
    setHistoryPast(past => [...past.slice(-49), measurementsRef.current]);
    setHistoryFuture(future => future.slice(0, -1));
    setMeasurements(next);
    setSelectedMeasurementId(null);
  }, [historyFuture]);

  const clearAllHistory = useCallback(() => {
    setHistoryPast([]);
    setHistoryFuture([]);
  }, []);

  // ---- Session restore (take-offs survive tab switches and page reloads) ----
  const hasRestoredRef = useRef(false);
  const lastProjectRef = useRef(currentProject.id);

  const resetLocalState = useCallback(() => {
    clearAllHistory();
    setMeasurements([]);
    setSelectedMeasurementId(null);
    setCurrentPoints([]);
    setBackgroundImage(null);
    setBackgroundImageSrc(null);
    setActiveFileName('No drawing loaded');
    setPdfPageCount(1);
    setCurrentPdfPage(1);
    setPixelsPerMeter(32);
  }, [clearAllHistory]);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    lastProjectRef.current = currentProject.id;

    const session = loadTakeoffSession(currentProject.id);
    if (!session || session.measurements.length === 0) return;

    setMeasurements(session.measurements);
    if (typeof session.pixelsPerMeter === 'number' && session.pixelsPerMeter > 0) {
      setPixelsPerMeter(session.pixelsPerMeter);
    }
    if (session.activeFileName) setActiveFileName(session.activeFileName);
    if (typeof session.currentPdfPage === 'number') setCurrentPdfPage(session.currentPdfPage);
    if (typeof session.pdfPageCount === 'number') setPdfPageCount(session.pdfPageCount);
    if (session.backgroundImageSrc) {
      setBackgroundImageSrc(session.backgroundImageSrc);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setBackgroundImage(img);
        fitImageToCanvas(img);
      };
      img.src = session.backgroundImageSrc!;
    }
    setSaveSuccessMessage(
      `Restored ${session.measurements.length} saved measurement${session.measurements.length === 1 ? '' : 's'} from this project.`
    );
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  }, [currentProject.id]);

  // Auto-save the session whenever the take-off changes (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasRestoredRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTakeoffSession(currentProject.id, {
        measurements,
        pixelsPerMeter,
        activeFileName,
        backgroundImageSrc,
        currentPdfPage,
        pdfPageCount
      });
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [measurements, pixelsPerMeter, activeFileName, backgroundImageSrc, currentPdfPage, pdfPageCount, currentProject.id]);

  // Clear transient state when the user switches projects
  useEffect(() => {
    if (lastProjectRef.current === currentProject.id) return;
    lastProjectRef.current = currentProject.id;
    hasRestoredRef.current = false;
    resetLocalState();
  }, [currentProject.id, resetLocalState]);

  // Explicit user action: discard the saved session entirely
  const resetSession = () => {
    if (!confirm('Discard this take-off session? Drawn measurements, scale calibration and the loaded drawing will be removed for this project.')) return;
    clearTakeoffSession(currentProject.id);
    hasRestoredRef.current = true;
    resetLocalState();
    setSaveSuccessMessage('Take-off session reset.');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // ---- Keyboard shortcuts ---------------------------------------------------
  // Functions defined further down the file are exposed via refs so the single
  // window-level listener stays registered without a stale-closure problem.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextFieldTarget(e.target)) return;
      if (isCalibrateModalOpen) return;
      keyHandlerRef.current(e);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCalibrateModalOpen]);

  // Initialize with the imported file preview (if any) — no mock sample drawings
  useEffect(() => {
    if (initialFilePreview) {
      loadImageFromSrc(initialFilePreview);
    }
  }, []);

  // Handle PDF rendering
  const renderPdfPage = async (pdfDoc: any, pageNum: number) => {
    try {
      setIsPdfLoading(true);
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = viewport.width;
      offscreenCanvas.height = viewport.height;
      const ctx = offscreenCanvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const imgUrl = offscreenCanvas.toDataURL('image/png');
        loadImageFromSrc(imgUrl, 40);
      }

      // Tier-2 vector extraction: read the page's drawing operators so walls /
      // rooms can be reconstructed automatically instead of drawn by hand.
      // The viewport transform is applied as the base CTM, so reconstructed
      // coordinates land in the SAME pixel space as the rendered bitmap above —
      // meaning the existing pixelsPerMeter scale applies directly.
      try {
        const opList = await page.getOperatorList();
        if (hasVectorGeometry(opList)) {
          const transform = (viewport as any).transform as number[] | undefined;
          const paths = reconstructPaths(opList, transform as any);
          setPdfVectorPaths(paths.length ? paths : null);
          // Reconstructed coords are in rendered-pixel space (scale 1.5), and the
          // page renders at 40 px/m — so 1 point-space unit == 1 rendered pixel.
          setPdfPointsPerMeter(40);
        } else {
          setPdfVectorPaths(null);
          setPdfPointsPerMeter(null);
        }
      } catch (vecErr) {
        console.warn('Vector extraction unavailable for this page:', vecErr);
        setPdfVectorPaths(null);
        setPdfPointsPerMeter(null);
      }
    } catch (err) {
      console.error('Error rendering PDF page:', err);
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Handle file uploads (PDF, Images)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActiveFileName(file.name);
    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const arrayBuffer = ev.target?.result as ArrayBuffer;
        if (arrayBuffer) {
          try {
            setIsPdfLoading(true);
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
            const doc = await loadingTask.promise;
            pdfDocRef.current = doc;
            setPdfPageCount(doc.numPages);
            setCurrentPdfPage(1);
            await renderPdfPage(doc, 1);
          } catch (err) {
            console.error('Failed to parse PDF:', err);
            alert('Could not render PDF. Please upload a high-resolution PNG or JPG export of the blueprint.');
          } finally {
            setIsPdfLoading(false);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          loadImageFromSrc(dataUrl, 32);
        }
      };
      reader.readAsDataURL(file);
    } else if (fileNameLower.endsWith('.svg')) {
      // Some browsers report an empty/absent MIME type for .svg, so match on
      // the extension too. Read as text, inject explicit dimensions when the
      // SVG lacks intrinsic sizing (otherwise <img> decodes to 0×0), then load.
      const reader = new FileReader();
      reader.onload = (ev) => {
        const svgText = ev.target?.result as string;
        if (!svgText) return;
        try {
          loadImageFromSrc(injectSvgDimensions(svgText), 32);
        } catch (err) {
          console.error('Failed to load SVG:', err);
          alert('Could not load this SVG. Try exporting your drawing as a high-resolution PNG or JPG.');
        }
      };
      reader.onerror = () => {
        alert('Could not read this SVG file. Try exporting your drawing as a PNG or JPG.');
      };
      reader.readAsText(file);
    } else {
      alert('Unsupported file type. Please upload a PDF, SVG, PNG, JPG, or WEBP blueprint.');
    }
  };

  // Calculations: Length and Area
  const calculateDistanceMeters = (p1: CanvasPoint, p2: CanvasPoint): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const pixelDistance = Math.hypot(dx, dy);
    return Number((pixelDistance / pixelsPerMeter).toFixed(2));
  };

  const calculateLineTotalLength = (points: CanvasPoint[]): number => {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += calculateDistanceMeters(points[i], points[i + 1]);
    }
    return Number(total.toFixed(2));
  };

  // Shoelace formula for polygon area
  const calculatePolygonAreaMeters = (points: CanvasPoint[]): number => {
    if (points.length < 3) return 0;
    let areaPixels = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      areaPixels += points[i].x * points[j].y;
      areaPixels -= points[j].x * points[i].y;
    }
    areaPixels = Math.abs(areaPixels) / 2;
    const areaMeters = areaPixels / (pixelsPerMeter * pixelsPerMeter);
    return Number(areaMeters.toFixed(2));
  };

  const calculatePolygonPerimeter = (points: CanvasPoint[]): number => {
    if (points.length < 3) return 0;
    let total = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      total += calculateDistanceMeters(points[i], points[j]);
    }
    return Number(total.toFixed(2));
  };

  /**
   * Tier-2 auto-extraction: turn reconstructed PDF vector paths into
   * VisualMeasurements on the canvas. Reuses classifyPathsToEntities for
   * synthetic-layer heuristics (walls / rooms / columns) and the existing calc
   * helpers so the produced measurements behave exactly like hand-drawn ones
   * (calibratable, BOQ-savable, opening-deductible).
   *
   * Reconstructed coordinates are in rendered-pixel space, and pixelsPerMeter is
   * the current scale — so we only classify by geometry here and let the calc
   * helpers apply the real-world scale. Point-space thresholds are scaled by
   * pixelsPerMeter so "long wall" / "big room" mean the same at any zoom/scale.
   */
  const autoExtractFromPdfVectors = () => {
    if (!pdfVectorPaths || pdfVectorPaths.length === 0) return;

    // Scale point-space thresholds to the current drawing scale so the
    // classifier is resolution-independent (a "wall" is >= ~0.3 m, a "room"
    // area >= ~4 m² in pixel² = (pixelsPerMeter² × m²)).
    const px = pixelsPerMeter;
    const entities = classifyPathsToEntities(pdfVectorPaths, {
      minWallLength: 0.3 * px,        // >= 0.3 m
      areaThreshold: 4 * px * px      // >= 4 m²
    });
    if (entities.length === 0) {
      setSaveSuccessMessage('No measurable wall/room geometry found in this PDF page.');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
      return;
    }

    const baseIndex = measurements.length;
    const newMeasurements: VisualMeasurement[] = entities.map((e, idx) => {
      const points: CanvasPoint[] = e.vertices.map(v => ({ x: v.x, y: v.y }));
      const color = MEASUREMENT_COLORS[(baseIndex + idx) % MEASUREMENT_COLORS.length];
      const isClosed = e.shape === true;

      if (isClosed) {
        const area = calculatePolygonAreaMeters(points);
        const perimeter = calculatePolygonPerimeter(points);
        const isSlab = e.layer === 'S-SLAB';
        return {
          id: 'vec-' + Date.now() + '-' + idx,
          name: `${isSlab ? 'Room/Slab' : 'Column'} Area #${baseIndex + idx + 1}`,
          type: 'polygon',
          points,
          category: isSlab ? activeCategory : 'Superstructure',
          lengthMeters: perimeter,
          areaMetersSquared: area,
          targetUnit: 'm²',
          heightOrThickness: isSlab ? currentProject.standardWallHeight : 0.15,
          unitRate: getDefaultRateForCategory(activeCategory, materials),
          color,
          isSavedToBOQ: false,
          isVisible: true
        };
      }

      // Open polyline → wall/beam run.
      let total = 0;
      for (let i = 0; i < points.length - 1; i++) total += calculateDistanceMeters(points[i], points[i + 1]);
      return {
        id: 'vec-' + Date.now() + '-' + idx,
        name: `Wall Run #${baseIndex + idx + 1}`,
        type: 'line',
        points,
        category: activeCategory,
        lengthMeters: Number(total.toFixed(2)),
        targetUnit: 'm',
        heightOrThickness: currentProject.standardWallHeight,
        widthThickness: 0.23,
        unitRate: getDefaultRateForCategory(activeCategory, materials),
        color,
        isSavedToBOQ: false,
        isVisible: true
      };
    });

    commitMeasurements(prev => [...prev, ...newMeasurements], { history: true });
    // The geometry now exists as real measurements — drop the ghost preview so
    // the canvas isn't double-drawn.
    setShowVectorPreview(false);
    setSaveSuccessMessage(
      `Auto-extracted ${newMeasurements.length} measurement${newMeasurements.length === 1 ? '' : 's'} from the PDF vector geometry.`
    );
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Coordinates transformation between screen and canvas image space
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): CanvasPoint => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Invert pan and zoom
    const imageX = (screenX - pan.x) / zoom;
    const imageY = (screenY - pan.y) / zoom;
    return { x: imageX, y: imageY };
  };

  // Magnetic snap to existing points within threshold
  const findSnapPoint = (pt: CanvasPoint): CanvasPoint => {
    const snapThreshold = 12 / zoom; // 12 screen pixels

    // Check current points
    for (const p of currentPoints) {
      if (Math.hypot(p.x - pt.x, p.y - pt.y) < snapThreshold) {
        return p;
      }
    }
    // Check existing measurements
    for (const m of measurements) {
      for (const p of m.points) {
        if (Math.hypot(p.x - pt.x, p.y - pt.y) < snapThreshold) {
          return p;
        }
      }
    }
    return pt;
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle click for panning (Shift is reserved for the ortho lock while drawing)
    if (e.button === 1 || drawingMode === 'select') {
      const coords0 = getCanvasCoords(e);

      // In select mode, a click near a vertex of the selected measurement starts
      // a vertex-drag instead of panning, so geometry can be refined by hand.
      if (e.button === 0 && drawingMode === 'select' && selectedMeasurementId) {
        const target = measurements.find(m => m.id === selectedMeasurementId);
        if (target) {
          const grabRadius = 8 / zoom;
          const hitIndex = target.points.findIndex(
            p => Math.hypot(p.x - coords0.x, p.y - coords0.y) <= grabRadius
          );
          if (hitIndex >= 0) {
            setDraggingVertex({ measId: target.id, index: hitIndex });
            return;
          }
        }
      }

      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return; // Only left click for drawing

    const rawCoords = getCanvasCoords(e);
    let coords = findSnapPoint(rawCoords);

    // Ortho lock: constrain the segment from the previous placed point to the
    // nearest 45° increment while drawing lines/polygons.
    if (isOrthoLocked && (drawingMode === 'line' || drawingMode === 'polygon' || drawingMode === 'rectangle') && currentPoints.length > 0) {
      coords = constrain45(currentPoints[currentPoints.length - 1], coords);
    }

    if (drawingMode === 'calibrate') {
      const newCalibPoints = [...calibrationPoints, coords];
      if (newCalibPoints.length === 2) {
        setCalibrationPoints(newCalibPoints);
        setIsCalibrateModalOpen(true);
      } else {
        setCalibrationPoints([coords]);
      }
      return;
    }

    if (drawingMode === 'line') {
      if (currentPoints.length === 0) {
        setCurrentPoints([coords]);
      } else {
        // Complete line
        const finalPoints = [...currentPoints, coords];
        const length = calculateLineTotalLength(finalPoints);
        const color = MEASUREMENT_COLORS[measurements.length % MEASUREMENT_COLORS.length];

        const newMeasurement: VisualMeasurement = {
          id: 'meas-' + Date.now(),
          name: `Line Takeoff #${measurements.length + 1}`,
          type: 'line',
          points: finalPoints,
          category: activeCategory,
          lengthMeters: length,
          targetUnit: 'm',
          heightOrThickness: currentProject.standardWallHeight,
          widthThickness: 0.23,
          unitRate: getDefaultRateForCategory(activeCategory, materials),
          color,
          isSavedToBOQ: false
        };

        setMeasurements(prev => [...prev, newMeasurement]);
        setSelectedMeasurementId(newMeasurement.id);
        setCurrentPoints([]);
      }
    } else if (drawingMode === 'polygon') {
      // Check if clicking close to the first point to close polygon
      if (currentPoints.length >= 2) {
        const firstPt = currentPoints[0];
        const distToStart = Math.hypot(coords.x - firstPt.x, coords.y - firstPt.y);
        if (distToStart < 15 / zoom) {
          // Close polygon
          finishPolygon();
          return;
        }
      }
      setCurrentPoints(prev => [...prev, coords]);
    } else if (drawingMode === 'rectangle') {
      if (currentPoints.length === 0) {
        setCurrentPoints([coords]);
      } else {
        // Create 4 points of rectangle
        const p1 = currentPoints[0];
        const p3 = coords;
        const p2 = { x: p3.x, y: p1.y };
        const p4 = { x: p1.x, y: p3.y };
        const rectPoints = [p1, p2, p3, p4];

        const area = calculatePolygonAreaMeters(rectPoints);
        const perimeter = calculatePolygonPerimeter(rectPoints);
        const color = MEASUREMENT_COLORS[measurements.length % MEASUREMENT_COLORS.length];

        const newMeasurement: VisualMeasurement = {
          id: 'meas-' + Date.now(),
          name: `Rect Area #${measurements.length + 1}`,
          type: 'rectangle',
          points: rectPoints,
          category: activeCategory,
          lengthMeters: perimeter,
          areaMetersSquared: area,
          targetUnit: 'm²',
          heightOrThickness: NBC_MEMBER_SIZES.slab.thickness, // 0.125 m (5") NBC 205 roof/floor slab
          unitRate: getDefaultRateForCategory(activeCategory, materials),
          color,
          isSavedToBOQ: false
        };

        setMeasurements(prev => [...prev, newMeasurement]);
        setSelectedMeasurementId(newMeasurement.id);
        setCurrentPoints([]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const rawCoords = getCanvasCoords(e);
    let coords = findSnapPoint(rawCoords);

    // Ortho-constrained live preview while drawing with the lock enabled.
    if (isOrthoLocked && (drawingMode === 'line' || drawingMode === 'polygon') && currentPoints.length > 0) {
      coords = constrain45(currentPoints[currentPoints.length - 1], coords);
    }

    // Dragging an existing vertex: move it and re-derive the measurement.
    if (draggingVertex) {
      commitMeasurements(
        prev => prev.map(m => {
          if (m.id !== draggingVertex.measId) return m;
          const newPoints = m.points.map((p, i) => (i === draggingVertex.index ? coords : p));
          return recomputeMeasurement({ ...m, points: newPoints }, pixelsPerMeter);
        }),
        { history: false } // don't push a snapshot per mousemove
      );
      setMousePos(coords);
      return;
    }

    setMousePos(coords);

    // Check if hovering near first point in polygon mode
    if (drawingMode === 'polygon' && currentPoints.length >= 2) {
      const firstPt = currentPoints[0];
      const dist = Math.hypot(coords.x - firstPt.x, coords.y - firstPt.y);
      setHoveredPointIndex(dist < 15 / zoom ? 0 : null);
    } else {
      setHoveredPointIndex(null);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (draggingVertex) {
      // The vertex just moved — snapshot once so a single undo reverts the whole drag.
      commitMeasurements(prev => prev, { history: false });
      setDraggingVertex(null);
    }
  };

  const finishPolygon = () => {
    if (currentPoints.length < 3) return;

    const area = calculatePolygonAreaMeters(currentPoints);
    const perimeter = calculatePolygonPerimeter(currentPoints);
    const color = MEASUREMENT_COLORS[measurements.length % MEASUREMENT_COLORS.length];

    const newMeasurement: VisualMeasurement = {
      id: 'meas-' + Date.now(),
      name: `Polygon Area #${measurements.length + 1}`,
      type: 'polygon',
      points: [...currentPoints],
      category: activeCategory,
      lengthMeters: perimeter,
      areaMetersSquared: area,
      targetUnit: 'm²',
      heightOrThickness: NBC_MEMBER_SIZES.slab.thickness, // 0.125 m (5") NBC 205 roof/floor slab
      unitRate: getDefaultRateForCategory(activeCategory, materials),
      color,
      isSavedToBOQ: false
    };

    setMeasurements(prev => [...prev, newMeasurement]);
    setSelectedMeasurementId(newMeasurement.id);
    setCurrentPoints([]);
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoom(prev => {
      const next = Math.min(Math.max(prev + delta, 0.2), 4.0);
      return Number(next.toFixed(2));
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    handleZoom(zoomFactor);
  };

  // Render loop to HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas pixel density to CSS display size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Apply Viewport Pan & Zoom
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Background Blueprint Image / PDF
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0);
    } else {
      // Empty grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < 1200; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 800);
        ctx.stroke();
      }
      for (let y = 0; y < 800; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1200, y);
        ctx.stroke();
      }
    }

    // 2. Draw Finished Measurements
    // Hidden measurements (eye toggled off) are skipped on the canvas, unless
    // currently selected — so the user can always locate what they clicked.
    const visibleMeasurements = measurements.filter(m => m.isVisible !== false || m.id === selectedMeasurementId);
    visibleMeasurements.forEach((m) => {
      const isSelected = m.id === selectedMeasurementId;
      ctx.save();

      if (m.type === 'line') {
        // Draw Line
        ctx.beginPath();
        ctx.moveTo(m.points[0].x, m.points[0].y);
        for (let i = 1; i < m.points.length; i++) {
          ctx.lineTo(m.points[i].x, m.points[i].y);
        }
        ctx.strokeStyle = isSelected ? '#38bdf8' : m.color;
        ctx.lineWidth = (isSelected ? 3.5 : 2.5) / zoom;
        ctx.stroke();

        // Draw Vertices
        m.points.forEach((p, idx) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, (idx === 0 || idx === m.points.length - 1 ? 4.5 : 3.5) / zoom, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? '#38bdf8' : m.color;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 / zoom;
          ctx.stroke();
        });

        // Midpoint Measurement Label
        if (m.points.length >= 2) {
          const midX = (m.points[0].x + m.points[1].x) / 2;
          const midY = (m.points[0].y + m.points[1].y) / 2;
          drawDimensionChip(ctx, `${m.lengthMeters} m`, midX, midY, m.color, zoom);
        }
      } else if (m.type === 'polygon' || m.type === 'rectangle') {
        // Draw Polygon with semi-transparent fill
        ctx.beginPath();
        ctx.moveTo(m.points[0].x, m.points[0].y);
        for (let i = 1; i < m.points.length; i++) {
          ctx.lineTo(m.points[i].x, m.points[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.28)' : `${m.color}33`; // 20% opacity
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#38bdf8' : m.color;
        ctx.lineWidth = (isSelected ? 3 : 2) / zoom;
        ctx.stroke();

        // Draw Vertices
        m.points.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? '#38bdf8' : m.color;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 / zoom;
          ctx.stroke();
        });

        // Polygon Centroid Label
        let cx = 0, cy = 0;
        m.points.forEach(p => { cx += p.x; cy += p.y; });
        cx /= m.points.length;
        cy /= m.points.length;
        drawDimensionChip(ctx, `${m.areaMetersSquared} m²`, cx, cy, m.color, zoom, `${m.lengthMeters}m perimeter`);
      }

      ctx.restore();
    });

    // 3. Draw Active Drawing In-Progress
    if (currentPoints.length > 0) {
      ctx.save();
      const activeColor = '#f59e0b'; // Amber

      if (drawingMode === 'line' && mousePos) {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = activeColor;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.lineWidth = 2.5 / zoom;
        ctx.stroke();
        ctx.setLineDash([]);

        // Live Length Tag
        const liveDist = calculateDistanceMeters(currentPoints[0], mousePos);
        const midX = (currentPoints[0].x + mousePos.x) / 2;
        const midY = (currentPoints[0].y + mousePos.y) / 2;
        drawDimensionChip(ctx, `${liveDist} m`, midX, midY, activeColor, zoom);
      } else if (drawingMode === 'polygon') {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
          ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        if (mousePos) {
          ctx.lineTo(mousePos.x, mousePos.y);
        }
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Closing guide to first point
        if (mousePos && currentPoints.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(mousePos.x, mousePos.y);
          ctx.lineTo(currentPoints[0].x, currentPoints[0].y);
          ctx.strokeStyle = hoveredPointIndex === 0 ? '#10b981' : 'rgba(245, 158, 11, 0.4)';
          ctx.lineWidth = 1.5 / zoom;
          ctx.stroke();
        }
      } else if (drawingMode === 'rectangle' && mousePos) {
        const p1 = currentPoints[0];
        const p3 = mousePos;
        ctx.beginPath();
        ctx.rect(
          Math.min(p1.x, p3.x),
          Math.min(p1.y, p3.y),
          Math.abs(p3.x - p1.x),
          Math.abs(p3.y - p1.y)
        );
        ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        ctx.fill();
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }

      // Draw all current points
      currentPoints.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, (idx === 0 && hoveredPointIndex === 0 ? 7 : 5) / zoom, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 && hoveredPointIndex === 0 ? '#10b981' : activeColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
      });

      ctx.restore();
    }

    // 3b. Vector-PDF preview: reconstructed geometry, color-coded by what it
    // will become, drawn UNDER the user's own measurements so it reads as a
    // "here's what we found" ghost layer before committing.
    if (pdfVectorPaths && pdfVectorPaths.length > 0 && showVectorPreview) {
      const px = pixelsPerMeter;
      const previewEntities = classifyPathsToEntities(pdfVectorPaths, {
        minWallLength: 0.3 * px,
        areaThreshold: 4 * px * px
      });
      ctx.save();
      previewEntities.forEach((e) => {
        const pts = e.vertices;
        if (!pts || pts.length < 2) return;
        const color = e.layer === 'S-SLAB' ? '#10b981' : e.layer === 'S-COLS' ? '#38bdf8' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (e.shape) ctx.closePath();
        ctx.fillStyle = e.shape ? color + '22' : 'transparent'; // subtle fill for closed shapes
        if (e.shape) ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = (e.shape ? 2 : 2.5) / zoom;
        ctx.setLineDash(e.shape ? [] : [6 / zoom, 4 / zoom]); // dashed for open wall runs
        ctx.stroke();
        ctx.setLineDash([]);
      });
      ctx.restore();
    }

    // 4. Draw Calibration Line if active
    if (drawingMode === 'calibrate') {
      ctx.save();
      if (calibrationPoints.length === 1 && mousePos) {
        ctx.beginPath();
        ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3 / zoom;
        ctx.stroke();
        const pDist = Math.hypot(mousePos.x - calibrationPoints[0].x, mousePos.y - calibrationPoints[0].y);
        drawDimensionChip(ctx, `Reference: ${pDist.toFixed(0)} px`, (calibrationPoints[0].x + mousePos.x) / 2, (calibrationPoints[0].y + mousePos.y) / 2, '#10b981', zoom);
      }
      calibrationPoints.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      });
      ctx.restore();
    }

    ctx.restore(); // Restore pan and zoom transform
    ctx.restore(); // Restore dpr transform
  }, [
    backgroundImage,
    measurements,
    currentPoints,
    mousePos,
    pan,
    zoom,
    drawingMode,
    selectedMeasurementId,
    hoveredPointIndex,
    calibrationPoints,
    pdfVectorPaths,
    showVectorPreview
  ]);

  // Helper to draw floating dimension chip
  const drawDimensionChip = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    badgeColor: string,
    currentZoom: number,
    subtitle?: string
  ) => {
    ctx.save();
    ctx.font = `bold ${Math.max(12 / currentZoom, 10)}px monospace`;
    const textWidth = ctx.measureText(text).width;
    const paddingX = 8 / currentZoom;
    const paddingY = 4 / currentZoom;
    const boxHeight = (subtitle ? 30 : 20) / currentZoom;
    const boxWidth = (textWidth + paddingX * 2);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1.5 / currentZoom;

    const rx = x - boxWidth / 2;
    const ry = y - boxHeight / 2;

    ctx.beginPath();
    ctx.roundRect(rx, ry, boxWidth, boxHeight, 4 / currentZoom);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - (subtitle ? 4 / currentZoom : 0));

    if (subtitle) {
      ctx.font = `${Math.max(9 / currentZoom, 8)}px monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(subtitle, x, y + 8 / currentZoom);
    }

    ctx.restore();
  };

  // Save-target: new BOQ item (default), subdivision row of an existing item,
  // or route into the standard 23-item BOQ schedule.
  const [saveTargetMode, setSaveTargetMode] = useState<'new' | 'existing' | 'standard'>('standard');
  const [attachTargetItemId, setAttachTargetItemId] = useState<string>(currentProject.items[0]?.id || '');

  // Shared take-off dimension resolver (used for both BOQ items and subdivision rows)
  const resolveTakeoffDims = (meas: VisualMeasurement) => {
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
        finalHeight = meas.heightOrThickness || currentProject.standardWallHeight;
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

  const buildSubLineFromMeasurement = (meas: VisualMeasurement): SubDivisionLine => {
    const dims = resolveTakeoffDims(meas);
    return {
      id: 'sub-vis-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      description: dims.description,
      qty: 1,
      length: dims.finalLength,
      width: dims.finalWidth,
      height: dims.finalHeight
    };
  };

  /**
   * Measurement-sheet lines for a standalone ("New BOQ Item") save: the gross
   * L×W×H line for the measurement plus a NEGATIVE deduction line carrying the
   * wall's share of the drawn door/window openings (m³ line math:
   * −1 × openingArea × wallThickness, identical to the old deductionsArea math).
   * The App-side save handler runs applySubdivisionSync, so the item's summary
   * quantity ends up equal to the sum of these lines.
   */
  const buildStandaloneSubLines = (meas: VisualMeasurement, deduction: number): SubDivisionLine[] => {
    const dims = resolveTakeoffDims(meas);
    const lines: SubDivisionLine[] = [{
      id: 'sub-vis-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      description: dims.description,
      qty: 1,
      length: dims.finalLength,
      width: dims.finalWidth,
      height: dims.finalHeight
    }];
    if (deduction > 0) {
      lines.push({
        id: 'sub-ded-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        description: `Less: door/window openings — ${deduction.toFixed(2)} m² × ${dims.finalWidth} m thickness`,
        qty: -1,
        length: Number(deduction.toFixed(3)),
        width: dims.finalWidth,
        height: 1
      });
    }
    return lines;
  };

  // Save a single measurement to BOQ
  const handleSaveToBOQ = (meas: VisualMeasurement) => {
    // Path S: route into the standard 23-item BOQ as a measurement-sheet line
    // under the standard item this measurement maps to.
    if (saveTargetMode === 'standard') {
      if (!onSaveStandardLinesToBOQ) return;
      const sn = standardSnForMeasurement({ category: meas.category, unit: meas.targetUnit, type: meas.type });
      onSaveStandardLinesToBOQ([{ sn, line: buildSubLineFromMeasurement(meas) }]);
      setMeasurements(prev => prev.map(m => m.id === meas.id ? { ...m, isSavedToBOQ: true } : m));
      setSaveSuccessMessage(`Saved "${meas.name}" into standard BOQ item #${sn}!`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
      return;
    }

    // Path A: attach as a subdivision row under an existing BOQ item
    if (saveTargetMode === 'existing') {
      const targetId = currentProject.items.some(i => i.id === attachTargetItemId)
        ? attachTargetItemId
        : currentProject.items[0]?.id;
      if (!targetId) {
        alert('No BOQ items available to attach to. Add a BOQ item first, or switch to "New BOQ Item" mode.');
        return;
      }
      onSaveSubdivisionToBOQ?.(targetId, [buildSubLineFromMeasurement(meas)]);
      setMeasurements(prev => prev.map(m => m.id === meas.id ? { ...m, isSavedToBOQ: true } : m));
      setSaveSuccessMessage(`Added "${meas.name}" as a subdivision line under the selected BOQ item!`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
      return;
    }

    // Path B: create a new standalone BOQ item (or UPDATE the one this
    // measurement created before, so "Update BOQ" never duplicates a row).
    const { finalUnit, finalLength, finalWidth, finalHeight, description } = resolveTakeoffDims(meas);

    // Wall runs deduct their share of the drawn door/window openings.
    const isWall = isWallMeasurement(meas);
    const deduction = isWall ? perWallOpeningDeduction(measurements) : 0;
    const descWithDeduction = deduction > 0
      ? `${description} − openings ${deduction.toFixed(2)} m²`
      : description;

    const isUpdate = !!meas.boqItemId;
    const newItem: MeasurementItem = {
      id: meas.boqItemId || 'boq-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      category: meas.category,
      description: descWithDeduction,
      unit: finalUnit,
      length: finalLength,
      width: finalWidth,
      height: finalHeight,
      qty: 1,
      wastagePercent: currentProject.wastageDefault,
      unitRate: resolveRate(meas, meas.category, materials),
      // Measurement-sheet detail (gross line + negative opening-deduction line).
      // deductionsArea is intentionally NOT set: the negative line IS the
      // deduction, and applySubdivisionSync (App side) derives qty from the lines.
      subDivisions: buildStandaloneSubLines(meas, deduction)
    };

    if (isUpdate) {
      onUpdateItemToBOQ(newItem);
    } else {
      onSaveItemToBOQ(newItem);
    }

    // Mark as saved and remember which BOQ row this measurement owns
    setMeasurements(prev => prev.map(m => m.id === meas.id
      ? { ...m, isSavedToBOQ: true, boqItemId: newItem.id }
      : m));
    setSaveSuccessMessage(isUpdate
      ? `Updated "${meas.name}" in the BOQ!`
      : `Saved "${meas.name}" to BOQ successfully!`);
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  // Batch save all unsaved measurements to BOQ
  const handleBatchSaveAllToBOQ = () => {
    const unsaved = measurements.filter(m => !m.isSavedToBOQ);
    if (unsaved.length === 0) {
      alert('All measurements have already been saved to the BOQ sheet.');
      return;
    }

    // Path S: route all pending measurements into the standard 23-item BOQ,
    // grouped by the standard item each maps to.
    if (saveTargetMode === 'standard') {
      if (!onSaveStandardLinesToBOQ) return;
      const entries = unsaved.map(meas => ({
        sn: standardSnForMeasurement({ category: meas.category, unit: meas.targetUnit, type: meas.type }),
        line: buildSubLineFromMeasurement(meas)
      }));
      const distinctSn = new Set(entries.map(e => e.sn)).size;
      onSaveStandardLinesToBOQ(entries);
      setMeasurements(prev => prev.map(m => ({ ...m, isSavedToBOQ: true })));
      setSaveSuccessMessage(`Pushed ${entries.length} measurement(s) into ${distinctSn} standard BOQ item(s)!`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
      return;
    }

    // Path A: attach all pending measurements as subdivision rows under one BOQ item
    if (saveTargetMode === 'existing') {
      const targetId = currentProject.items.some(i => i.id === attachTargetItemId)
        ? attachTargetItemId
        : currentProject.items[0]?.id;
      if (!targetId) {
        alert('No BOQ items available to attach to. Add a BOQ item first, or switch to "New BOQ Item" mode.');
        return;
      }
      const lines = unsaved.map(buildSubLineFromMeasurement);
      onSaveSubdivisionToBOQ?.(targetId, lines);
      setMeasurements(prev => prev.map(m => ({ ...m, isSavedToBOQ: true })));
      setSaveSuccessMessage(`Added ${lines.length} take-off line(s) as subdivision rows under the selected BOQ item!`);
      setTimeout(() => setSaveSuccessMessage(null), 3500);
      return;
    }

    // Path B: create standalone BOQ items
    const wallDeduction = perWallOpeningDeduction(measurements);
    const itemsToSave: MeasurementItem[] = unsaved.map((meas, idx) => {
      const { finalUnit, finalLength, finalWidth, finalHeight, description } = resolveTakeoffDims(meas);
      const isWall = isWallMeasurement(meas);
      const deduction = isWall ? wallDeduction : 0;
      return {
        id: 'boq-batch-' + Date.now() + '-' + idx,
        category: meas.category,
        description: deduction > 0 ? `${description} − openings ${deduction.toFixed(2)} m²` : description,
        unit: finalUnit,
        length: finalLength,
        width: finalWidth,
        height: finalHeight,
        qty: 1,
        wastagePercent: currentProject.wastageDefault,
        unitRate: resolveRate(meas, meas.category, materials),
        // Sheet-backed: gross line + negative opening-deduction line (see the
        // single-measurement Path B above); applySubdivisionSync runs App-side.
        subDivisions: buildStandaloneSubLines(meas, deduction)
      };
    });

    onBatchSaveItemsToBOQ(itemsToSave);

    // Mark all as saved
    setMeasurements(prev => prev.map(m => ({ ...m, isSavedToBOQ: true })));
    setSaveSuccessMessage(`Successfully pushed ${unsaved.length} visual measurement items to the BOQ!`);
    setTimeout(() => setSaveSuccessMessage(null), 3500);
  };

  const selectedMeasurement = measurements.find(m => m.id === selectedMeasurementId);

  // ---- Bind the keyboard handler -------------------------------------------
  // The window-level listener (defined earlier) reads keyHandlerRef.current on
  // every keydown. Re-assigning it each render keeps the handler's closures
  // fresh without re-subscribing the listener. This is what actually enables
  // the shortcuts (previously the ref stayed a no-op, so nothing fired).
  useEffect(() => {
    keyHandlerRef.current = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Undo / redo (suppress while a modifier is NOT needed by the others)
      if (mod && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }
      if (
        (mod && (e.key === 'y' || e.key === 'Y')) ||
        (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        performRedo();
        return;
      }

      switch (e.key) {
        case 'Escape':
          // Abandon the in-progress shape (or leave calibrate mode)
          setCurrentPoints([]);
          if (drawingMode === 'calibrate') setDrawingMode('select');
          break;
        case 'Enter':
          if (drawingMode === 'polygon') finishPolygon();
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedMeasurementId) {
            commitMeasurements(prev => prev.filter(m => m.id !== selectedMeasurementId), { history: true });
            setSelectedMeasurementId(null);
          }
          break;
        case 'l': case 'L':
          setDrawingMode('line'); setCurrentPoints([]); break;
        case 'p': case 'P':
          setDrawingMode('polygon'); setCurrentPoints([]); break;
        case 'r': case 'R':
          setDrawingMode('rectangle'); setCurrentPoints([]); break;
        case 'c': case 'C':
          setDrawingMode('calibrate'); setCurrentPoints([]); setCalibrationPoints([]); break;
        case 's': case 'S':
          setDrawingMode('select'); setCurrentPoints([]); break;
        case '+': case '=':
          handleZoom(0.15); break;
        case '-': case '_':
          handleZoom(-0.15); break;
        case 'f': case 'F':
          if (backgroundImage) fitImageToCanvas(backgroundImage); break;
        default:
          break;
      }
    };
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {saveSuccessMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold animate-fade-in shadow-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button onClick={() => setSaveSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Blueprint & Canvas Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Top Header: Plan Switcher & File Upload */}
        <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-950/60">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <span className="bg-amber-500/20 text-amber-400 p-1.5 rounded-lg">
                <Ruler className="w-5 h-5" />
              </span>
              <span>Visual Take-Off Canvas Overlay</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Draw lines or polygons over blueprints, calibrated scale plans, or PDFs to calculate exact lengths &amp; areas, then push directly to BOQ.
            </p>
          </div>

          {/* Upload Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 cursor-pointer transition shadow">
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Upload Blueprint (PDF/IMG)</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        {/* Toolbar: Drawing Tools, Scale & Zoom */}
        <div className="p-3 md:px-6 bg-slate-950 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
          {/* Drawing Tool Selectors */}
          <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => { setDrawingMode('select'); setCurrentPoints([]); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                drawingMode === 'select'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Select & Pan Tool"
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Select / Pan</span>
            </button>

            <button
              onClick={() => { setDrawingMode('line'); setCurrentPoints([]); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                drawingMode === 'line'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Linear Measure: Walls, Trenches, Pipes"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Line (Length)</span>
            </button>

            <button
              onClick={() => { setDrawingMode('polygon'); setCurrentPoints([]); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                drawingMode === 'polygon'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Polygon Area: Rooms, Slabs, Pavements"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Polygon (Area)</span>
            </button>

            <button
              onClick={() => { setDrawingMode('rectangle'); setCurrentPoints([]); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                drawingMode === 'rectangle'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Box Area"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rectangle</span>
            </button>

            {/* Ortho / 45° lock */}
            <button
              onClick={() => setIsOrthoLocked(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition ${
                isOrthoLocked
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
              title="Ortho lock: snap the next segment to the nearest 45°"
            >
              <MoveDiagonal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Ortho</span>
            </button>

            {/* Keyboard shortcut legend */}
            <button
              onClick={() => setShowShortcutHelp(v => !v)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition border border-slate-800 bg-slate-900"
              title="Keyboard shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </div>

          {showShortcutHelp && (
            <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-[11px] text-slate-400 font-mono">
              {([
                ['Esc', 'Cancel current shape'],
                ['Enter', 'Finish polygon'],
                ['L / P / R / C / S', 'Line / Polygon / Rect / Calibrate / Select'],
                ['Del / Backspace', 'Delete selected measurement'],
                ['Ctrl+Z', 'Undo'],
                ['Ctrl+Shift+Z', 'Redo'],
                ['+ / −', 'Zoom in / out'],
                ['F', 'Fit drawing to canvas']
              ] as const).map(([key, desc]) => (
                <div key={key} className="flex items-center space-x-2">
                  <span className="bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded border border-slate-700">{key}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Active Drawing Actions (Finish Polygon, Cancel) */}
          {currentPoints.length > 0 && (
            <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
              <span className="text-xs text-amber-400 font-mono">
                {currentPoints.length} point{currentPoints.length > 1 ? 's' : ''} placed
              </span>
              {drawingMode === 'polygon' && currentPoints.length >= 3 && (
                <button
                  onClick={finishPolygon}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Close &amp; Finish</span>
                </button>
              )}
              <button
                onClick={() => setCurrentPoints([])}
                className="text-slate-400 hover:text-rose-400 text-xs px-1.5 py-0.5 rounded transition"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Scale Calibration & Zoom Tools */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setDrawingMode('calibrate');
                setCalibrationPoints([]);
                setCurrentPoints([]);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border transition ${
                drawingMode === 'calibrate'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
              title="Calibrate scale with 2 known points"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Calibrate Scale (1m = {pixelsPerMeter.toFixed(0)}px)</span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => handleZoom(-0.15)}
                className="p-1.5 text-slate-400 hover:text-slate-100 transition rounded-lg hover:bg-slate-800"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-300 px-2">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => handleZoom(0.15)}
                className="p-1.5 text-slate-400 hover:text-slate-100 transition rounded-lg hover:bg-slate-800"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (backgroundImage) fitImageToCanvas(backgroundImage);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-100 transition rounded-lg hover:bg-slate-800 border-l border-slate-800"
                title="Fit to Canvas"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const next = !isExpanded;
                  setIsExpanded(next);
                  // Re-fit after the viewport height change is applied.
                  requestAnimationFrame(() => {
                    if (backgroundImage) fitImageToCanvas(backgroundImage);
                  });
                }}
                className="p-1.5 text-slate-400 hover:text-slate-100 transition rounded-lg hover:bg-slate-800"
                title={isExpanded ? 'Exit full-height canvas' : 'Expand canvas to full height'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Multi-page PDF pagination */}
            {pdfPageCount > 1 && (
              <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl text-xs">
                <span className="text-slate-400 text-[11px]">PDF Page:</span>
                <button
                  disabled={currentPdfPage <= 1 || isPdfLoading}
                  onClick={() => {
                    const prevPage = currentPdfPage - 1;
                    setCurrentPdfPage(prevPage);
                    if (pdfDocRef.current) renderPdfPage(pdfDocRef.current, prevPage);
                  }}
                  className="px-1.5 py-0.5 text-slate-300 disabled:opacity-40"
                >
                  &lt;
                </button>
                <span className="font-mono text-amber-400">{currentPdfPage}/{pdfPageCount}</span>
                <button
                  disabled={currentPdfPage >= pdfPageCount || isPdfLoading}
                  onClick={() => {
                    const nextPage = currentPdfPage + 1;
                    setCurrentPdfPage(nextPage);
                    if (pdfDocRef.current) renderPdfPage(pdfDocRef.current, nextPage);
                  }}
                  className="px-1.5 py-0.5 text-slate-300 disabled:opacity-40"
                >
                  &gt;
                </button>
              </div>
            )}

            {/* Tier-2 vector-PDF auto-extraction (only for vector PDFs) */}
            {pdfVectorPaths && pdfVectorPaths.length > 0 && (
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1">
                <button
                  onClick={autoExtractFromPdfVectors}
                  disabled={isPdfLoading}
                  className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-40"
                  title="Read the PDF's vector geometry and auto-generate wall/room measurements"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Extract Geometry</span>
                </button>
                <button
                  onClick={() => setShowVectorPreview(v => !v)}
                  className={`p-1.5 rounded-lg transition ${showVectorPreview ? 'text-amber-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'}`}
                  title={showVectorPreview ? 'Hide geometry preview overlay' : 'Show geometry preview overlay'}
                >
                  {showVectorPreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                {/* Legend: what each preview colour becomes on extraction */}
                <div className="hidden md:flex items-center space-x-2 text-[10px] text-slate-400 pl-1 border-l border-slate-800">
                  <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f59e0b' }} /><span>Walls</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#10b981' }} /><span>Rooms</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#38bdf8' }} /><span>Columns</span></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Display Viewport */}
        <div
          ref={containerRef}
          className={`relative w-full bg-slate-950 overflow-hidden cursor-crosshair select-none ${
            isExpanded ? 'h-[calc(100vh-220px)]' : 'h-[520px]'
          }`}
        >
          {isPdfLoading && (
            <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-amber-400 font-mono">Rendering PDF blueprint vector page...</p>
            </div>
          )}

          {/* Empty state: prompt to load a real drawing */}
          {!backgroundImage && !isPdfLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center space-y-3 pointer-events-none text-center px-6">
              <Upload className="w-10 h-10 text-slate-600" />
              <h4 className="text-sm font-semibold text-slate-300">No Drawing Loaded</h4>
              <p className="text-xs text-slate-500 max-w-md">
                Upload a real blueprint (<span className="text-amber-400">PDF, PNG, JPG</span>) or import a DXF above to start measuring. All take-off data comes from your drawings — no sample plans are preloaded.
              </p>
            </div>
          )}

          {/* Interactive HTML5 Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full block"
          />

          {/* Canvas Floating Instructions Bar */}
          <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 flex items-center space-x-3 pointer-events-none shadow-lg">
            <div className="flex items-center space-x-1.5 text-amber-400 font-medium">
              <Eye className="w-3.5 h-3.5" />
              <span>File: {activeFileName}</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              {drawingMode === 'line' && 'Click start point, then click end point to create a line segment.'}
              {drawingMode === 'polygon' && 'Click vertices. Click the green start point or "Close & Finish" to seal polygon.'}
              {drawingMode === 'rectangle' && 'Click first corner, then click opposite corner to create box.'}
              {drawingMode === 'calibrate' && 'Click 2 points across a known dimension to calibrate real-world scale.'}
              {drawingMode === 'select' && 'Drag to pan around blueprint. Use mouse wheel to zoom.'}
            </span>
          </div>

          {/* Quick Clear Current Shape */}
          {currentPoints.length > 0 && (
            <button
              onClick={() => setCurrentPoints([])}
              className="absolute top-3 right-3 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-rose-400 px-3 py-1.5 rounded-xl text-xs font-semibold shadow"
            >
              Clear Current Shape
            </button>
          )}
        </div>
      </div>

      {/* Measurement Management & BOQ Transfer Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Recorded Visual Measurements ({measurements.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review lengths and calculated surface areas. Assign construction categories and push directly into the BOQ sheet.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'All' | MeasurementCategory)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
              title="Filter the table by BOQ category"
            >
              <option value="All">All categories</option>
              {PREDEFINED_CATEGORIES.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            {/* Undo / redo the measurement list */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={performUndo}
                disabled={historyPast.length === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={performRedo}
                disabled={historyFuture.length === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Export the take-off sheet */}
            {measurements.length > 0 && (
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
                <button
                  onClick={() => exportTakeoffCsv(measurements, currentProject, materials)}
                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition flex items-center space-x-1.5 text-xs font-semibold"
                  title="Export take-off as CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  onClick={() => exportTakeoffJson(measurements, currentProject, pixelsPerMeter, activeFileName)}
                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition flex items-center space-x-1.5 text-xs font-semibold"
                  title="Export take-off as JSON (includes scale)"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">JSON</span>
                </button>
              </div>
            )}

            {measurements.length > 0 && (
              <button
                onClick={handleBatchSaveAllToBOQ}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save All to BOQ ({measurements.filter(m => !m.isSavedToBOQ).length} pending)</span>
              </button>
            )}

            {measurements.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all drawn visual measurements?')) {
                    setMeasurements([]);
                    setSelectedMeasurementId(null);
                  }
                }}
                className="text-xs text-rose-400 hover:text-rose-300 px-3 py-2 border border-slate-800 rounded-xl hover:bg-slate-800 transition"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Save Target Picker: standard 23-item BOQ vs new item vs subdivision */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Save Target:</span>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="radio"
              name="save-target"
              checked={saveTargetMode === 'standard'}
              onChange={() => setSaveTargetMode('standard')}
              className="accent-amber-500"
            />
            Standard 23-Item BOQ
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="radio"
              name="save-target"
              checked={saveTargetMode === 'new'}
              onChange={() => setSaveTargetMode('new')}
              className="accent-amber-500"
            />
            New BOQ Item
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="radio"
              name="save-target"
              checked={saveTargetMode === 'existing'}
              onChange={() => setSaveTargetMode('existing')}
              className="accent-amber-500"
            />
            Subdivision Line of:
          </label>
          {saveTargetMode === 'existing' ? (
            <select
              value={currentProject.items.some(i => i.id === attachTargetItemId) ? attachTargetItemId : (currentProject.items[0]?.id || '')}
              onChange={(e) => setAttachTargetItemId(e.target.value)}
              className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {currentProject.items.length === 0 && (
                <option value="">No BOQ items available — add one first</option>
              )}
              {currentProject.items.map(i => {
                const desc = i.description || 'BOQ Item';
                return (
                  <option key={i.id} value={i.id}>
                    {desc.length > 70 ? desc.slice(0, 70) + '…' : desc}
                  </option>
                );
              })}
            </select>
          ) : saveTargetMode === 'standard' ? (
            <span className="text-[11px] text-slate-500">each measurement maps to its standard item (walls→#9, slabs→#6, etc.)</span>
          ) : (
            <span className="text-[11px] text-slate-600">each measurement becomes its own BOQ row (original behavior)</span>
          )}
        </div>

        {/* Summary strip — live totals across all drawn measurements */}
        {measurements.length > 0 && (() => {
          let sumLen = 0;
          let sumArea = 0;
          let sumVol = 0;
          let sumCost = 0;
          measurements.forEach(m => {
            sumLen += m.lengthMeters || 0;
            sumArea += m.areaMetersSquared || 0;
            const dims = resolveTakeoffDims(m);
            const rate = resolveRate(m, m.category, materials);
            // quantity × rate, scaled to the resolved unit's magnitude
            let qtyValue = 0;
            if (dims.finalUnit === 'm³') {
              qtyValue = dims.finalLength * dims.finalWidth * dims.finalHeight;
              sumVol += qtyValue;
            } else if (dims.finalUnit === 'm²') {
              qtyValue = dims.finalLength;
            } else {
              qtyValue = dims.finalLength;
            }
            sumCost += qtyValue * rate;
          });
          const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: d });
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Measurements</p>
                <p className="text-lg font-black text-slate-100 font-mono mt-0.5">{measurements.length}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Σ Linear</p>
                <p className="text-lg font-black text-amber-400 font-mono mt-0.5">{fmt(sumLen)} m</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Σ Area</p>
                <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">{fmt(sumArea)} m²</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">Σ Volume</p>
                <p className="text-lg font-black text-sky-400 font-mono mt-0.5">{fmt(sumVol)} m³</p>
              </div>
            </div>
          );
        })()}

        {/* Estimated cost banner */}
        {measurements.length > 0 && (() => {
          const totalCost = measurements.reduce((acc, m) => {
            const dims = resolveTakeoffDims(m);
            const rate = resolveRate(m, m.category, materials);
            const qtyValue = dims.finalUnit === 'm³'
              ? dims.finalLength * dims.finalWidth * dims.finalHeight
              : dims.finalLength;
            return acc + qtyValue * rate;
          }, 0);
          if (totalCost <= 0) return null;
          return (
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 rounded-xl px-4 py-3">
              <span className="text-xs text-slate-300 font-semibold">Estimated Take-Off Value</span>
              <span className="text-lg font-black text-amber-400 font-mono">
                {currentProject.currency} {totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          );
        })()}

        {/* Selected Measurement Config / Quick Editor */}
        {selectedMeasurement && (
          <div className="bg-slate-950 border border-amber-500/30 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                Configuring Selected Measurement
              </span>
              <button
                onClick={() => setSelectedMeasurementId(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Item Title / Name</label>
                <input
                  type="text"
                  value={selectedMeasurement.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setMeasurements(prev => prev.map(m => m.id === selectedMeasurement.id ? { ...m, name: newName } : m));
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">BOQ Category</label>
                <select
                  value={selectedMeasurement.category}
                  onChange={(e) => {
                    const newCat = e.target.value as MeasurementCategory;
                    setMeasurements(prev => prev.map(m => m.id === selectedMeasurement.id ? { ...m, category: newCat } : m));
                    setActiveCategory(newCat);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-amber-400 font-medium"
                >
                  {PREDEFINED_CATEGORIES.map(cat => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Takeoff Target Unit</label>
                <select
                  value={selectedMeasurement.targetUnit}
                  onChange={(e) => {
                    const newUnit = e.target.value as 'm' | 'm²' | 'm³';
                    setMeasurements(prev => prev.map(m => m.id === selectedMeasurement.id ? { ...m, targetUnit: newUnit } : m));
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                >
                  <option value="m">Linear Length (m)</option>
                  <option value="m²">Surface Area (m²)</option>
                  <option value="m³">Solid Volume (m³)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Unit Rate ({currentProject.currency})
                </label>
                <input
                  type="number"
                  value={selectedMeasurement.unitRate ?? resolveRate(selectedMeasurement, selectedMeasurement.category, materials)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setMeasurements(prev => prev.map(m => m.id === selectedMeasurement.id ? { ...m, unitRate: val } : m));
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                />
              </div>

              {/* Volume dimensions — only meaningful when the target unit is m³.
                  These feed the L × W × H volume used for the BOQ quantity. */}
              {selectedMeasurement.targetUnit === 'm³' && (
                <>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {selectedMeasurement.type === 'line' ? 'Wall Height (m)' : 'Slab / Trench Depth (m)'}
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedMeasurement.heightOrThickness || 3.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setMeasurements(prev => prev.map(m => m.id === selectedMeasurement.id ? { ...m, heightOrThickness: val } : m));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Width / Thickness (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedMeasurement.widthThickness || 0.23}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setMeasurements(prev => prev.map(m => m.id === selectedMeasurement.id ? { ...m, widthThickness: val } : m));
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Measurements List Table */}
        {measurements.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <Ruler className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-slate-300">No Visual Measurements Drawn Yet</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Select the <span className="text-amber-400 font-semibold">Line (Length)</span> or <span className="text-amber-400 font-semibold">Polygon (Area)</span> tool above to measure distances and surface areas over the blueprint plan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase bg-slate-950/80">
                  <th className="py-3 px-4">Color / Tag</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Linear Length</th>
                  <th className="py-3 px-4 text-right">Calculated Area</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {(categoryFilter === 'All'
                  ? measurements
                  : measurements.filter(m => m.category === categoryFilter)
                ).map((meas) => {
                  const isSelected = meas.id === selectedMeasurementId;
                  return (
                    <tr
                      key={meas.id}
                      onClick={() => setSelectedMeasurementId(meas.id)}
                      className={`cursor-pointer transition ${
                        isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 px-4 font-medium flex items-center space-x-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full inline-block border border-white/20 shrink-0"
                          style={{ backgroundColor: meas.color }}
                        />
                        <span className="font-semibold text-slate-100">{meas.name}</span>
                      </td>

                      <td className="py-3 px-4 text-slate-400 capitalize">
                        {meas.type}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-bold uppercase border ${getCategoryBadgeClass(meas.category)}`}>
                          {meas.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-amber-400 font-bold">
                        {meas.lengthMeters} m
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                        {meas.areaMetersSquared !== undefined ? `${meas.areaMetersSquared} m²` : '—'}
                      </td>

                      <td className="py-3 px-4 text-center font-mono">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                          {meas.targetUnit}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {meas.isSavedToBOQ ? (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>In BOQ</span>
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">
                            Draft
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveToBOQ(meas);
                          }}
                          className={`px-3 py-1 rounded-lg font-bold text-xs transition shadow ${
                            meas.isSavedToBOQ
                              ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          }`}
                        >
                          {meas.isSavedToBOQ ? 'Update BOQ' : '+ Save to BOQ'}
                        </button>

                        {/* Toggle canvas visibility (hides the overlay but keeps the row) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMeasurements(prev => prev.map(m => m.id === meas.id ? { ...m, isVisible: m.isVisible === false ? true : false } : m));
                          }}
                          className="p-1 text-slate-500 hover:text-sky-400 transition"
                          title={meas.isVisible === false ? 'Show on canvas' : 'Hide on canvas'}
                        >
                          {meas.isVisible === false ? <EyeOff className="w-3.5 h-3.5 inline" /> : <Eye className="w-3.5 h-3.5 inline" />}
                        </button>

                        {/* Duplicate with a small offset so the copy is visible & selectable */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const offset = 12;
                            const clone: VisualMeasurement = {
                              ...meas,
                              id: 'meas-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                              name: `${meas.name} (copy)`,
                              points: meas.points.map(p => ({ x: p.x + offset, y: p.y + offset })),
                              isSavedToBOQ: false,
                              boqItemId: undefined,
                              subLineIds: undefined
                            };
                            commitMeasurements(prev => [...prev, clone], { history: true });
                          }}
                          className="p-1 text-slate-500 hover:text-amber-400 transition"
                          title="Duplicate Measurement"
                        >
                          <Copy className="w-3.5 h-3.5 inline" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            commitMeasurements(prev => prev.filter(m => m.id !== meas.id), { history: true });
                            if (selectedMeasurementId === meas.id) setSelectedMeasurementId(null);
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Delete Measurement"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scale Calibration Modal */}
      {isCalibrateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Calibrate Real-World Scale</span>
              </h3>
              <button
                onClick={() => {
                  setIsCalibrateModalOpen(false);
                  setCalibrationPoints([]);
                  setDrawingMode('select');
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              You clicked 2 reference points on the drawing. Enter the actual physical distance between these points to calibrate the drawing scale.
            </p>

            {calibrationPoints.length === 2 && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 flex justify-between">
                <span>Pixel Distance Measured:</span>
                <span className="text-amber-400 font-bold">
                  {Math.hypot(
                    calibrationPoints[1].x - calibrationPoints[0].x,
                    calibrationPoints[1].y - calibrationPoints[0].y
                  ).toFixed(1)} px
                </span>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-semibold">
                Actual Physical Distance (in meters):
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={calibrationLengthInput}
                onChange={(e) => setCalibrationLengthInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                placeholder="e.g. 5.0"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setIsCalibrateModalOpen(false);
                  setCalibrationPoints([]);
                  setDrawingMode('select');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const physicalMeters = parseFloat(calibrationLengthInput);
                  if (physicalMeters > 0 && calibrationPoints.length === 2) {
                    const pixelDistance = Math.hypot(
                      calibrationPoints[1].x - calibrationPoints[0].x,
                      calibrationPoints[1].y - calibrationPoints[0].y
                    );
                    const newScale = pixelDistance / physicalMeters;
                    setPixelsPerMeter(newScale);

                    // Re-derive every measurement's length/area from its stored
                    // geometry at the new scale (undoable via the history stack).
                    commitMeasurements(prev => recomputeAll(prev, newScale), { history: true });

                    setIsCalibrateModalOpen(false);
                    setCalibrationPoints([]);
                    setDrawingMode('select');
                    setSaveSuccessMessage(`Scale calibrated: 1 meter = ${newScale.toFixed(1)} px. All measurements updated!`);
                    setTimeout(() => setSaveSuccessMessage(null), 3500);
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition shadow"
              >
                Apply Calibration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
