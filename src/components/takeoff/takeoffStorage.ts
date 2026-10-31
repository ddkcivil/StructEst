import { CanvasPoint, VisualMeasurement } from '../BlueprintCanvasOverlay';

/**
 * Session persistence for the Take-Off Blueprint tab.
 *
 * Drawn measurements, the calibrated scale, the loaded file name and the raw
 * image source are saved to localStorage per project, so switching tabs or
 * reloading the browser no longer destroys the user's take-off work.
 */

const STORAGE_KEY = 'structest_takeoffs_v1';

export interface TakeoffSession {
  measurements: VisualMeasurement[];
  pixelsPerMeter: number;
  activeFileName: string;
  /** Data URL / object URL of the loaded drawing, so it can be restored. */
  backgroundImageSrc?: string | null;
  /** Which PDF page was being viewed, when the source was a PDF. */
  currentPdfPage: number;
  pdfPageCount: number;
  savedAt: string;
}

type Store = Record<string, TakeoffSession>;

const readStore = (): Store => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Take-off session store unreadable, starting fresh:', err);
    return {};
  }
};

const writeStore = (store: Store) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    // Most likely quota exhaustion from a large image data URL. Drop the image
    // source but keep the measurements — losing the drawing beats losing the work.
    console.warn('Take-off session save failed, retrying without image source:', err);
    try {
      const slim: Store = {};
      Object.entries(store).forEach(([k, v]) => {
        slim[k] = { ...v, backgroundImageSrc: null };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch (err2) {
      console.warn('Take-off session could not be persisted:', err2);
    }
  }
};

/** Load the saved session for a project, or null when none exists. */
export const loadTakeoffSession = (projectId: string): TakeoffSession | null => {
  const session = readStore()[projectId];
  if (!session || !Array.isArray(session.measurements)) return null;
  return session;
};

/** Persist a project's take-off session (replacing the previous one). */
export const saveTakeoffSession = (
  projectId: string,
  session: Omit<TakeoffSession, 'savedAt'>
): void => {
  const store = readStore();
  store[projectId] = { ...session, savedAt: new Date().toISOString() };
  writeStore(store);
};

/** Remove the stored session for a project (used by the "Reset" action). */
export const clearTakeoffSession = (projectId: string): void => {
  const store = readStore();
  delete store[projectId];
  writeStore(store);
};
