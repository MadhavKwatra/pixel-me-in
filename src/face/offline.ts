/**
 * Offline face finder: puts the MediaPipe files (~17 MB) into the same cache the
 * service worker uses for them (`mediapipe`, see vite.config.ts), so the Photo
 * Booth also works with no connection. Everything else is precached on install.
 *
 * It runs by itself when the game is installed (and when the installed app opens
 * online without it), unless the phone asks to save data. Settings has a button too.
 */
const CACHE = 'mediapipe';
let running: Promise<boolean> | null = null;

/** The exact files the face finder loads on this device (SIMD or not). */
async function files(): Promise<string[]> {
  const { FilesetResolver } = await import('@mediapipe/tasks-vision');
  const base = new URL('mediapipe/', document.baseURI).href;
  const set = await FilesetResolver.forVisionTasks(base + 'wasm');
  return [
    set.wasmLoaderPath,
    set.wasmBinaryPath,
    base + 'models/face_landmarker.task',
    base + 'models/selfie_segmenter.tflite',
  ];
}

const supported = () => typeof caches !== 'undefined' && 'serviceWorker' in navigator;

/** Is everything for an offline Photo Booth already on this device? */
export async function faceFinderReady(): Promise<boolean> {
  if (!supported()) return false;
  const cache = await caches.open(CACHE);
  const hits = await Promise.all((await files()).map((u) => cache.match(u)));
  return hits.every(Boolean);
}

/** Download what is missing. Resolves true when the Photo Booth works offline. */
export function downloadFaceFinder(): Promise<boolean> {
  if (!supported() || !navigator.onLine) return Promise.resolve(false);
  running ??= (async () => {
    try {
      const cache = await caches.open(CACHE);
      for (const url of await files()) if (!(await cache.match(url))) await cache.add(url);
      return true;
    } catch {
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** The phone asked to save mobile data: never download big files by ourselves. */
export function saveDataOn(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!c?.saveData;
}
