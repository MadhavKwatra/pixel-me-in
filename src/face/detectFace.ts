/**
 * Step 2: find the face (MediaPipe Face Landmarker, 478 points) and the person
 * (MediaPipe Image Segmenter, selfie model). Both models and the WASM runtime
 * are served from this site (public/mediapipe/) and run on the player's CPU.
 * No image data is sent anywhere.
 */
import type { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import type { Box, FaceDetection } from './geometry';
import type { PersonMask } from './headMask';

interface Models {
  landmarker: FaceLandmarker;
  segmenter: ImageSegmenter;
}

let models: Promise<Models> | null = null;

/** Load once, lazily: only the photo screen pays for the ~17 MB download. */
export function loadDetector(): Promise<Models> {
  if (!models) {
    models = (async () => {
      const { FaceLandmarker, FilesetResolver, ImageSegmenter } =
        await import('@mediapipe/tasks-vision');
      const base = new URL('mediapipe/', document.baseURI).href;
      const fileset = await FilesetResolver.forVisionTasks(base + 'wasm');
      const [landmarker, segmenter] = await Promise.all([
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: base + 'models/face_landmarker.task', delegate: 'CPU' },
          runningMode: 'IMAGE',
          numFaces: 4,
        }),
        ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: base + 'models/selfie_segmenter.tflite', delegate: 'CPU' },
          runningMode: 'IMAGE',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        }),
      ]);
      return { landmarker, segmenter };
    })();
    // Let a later call retry if loading failed (e.g. offline on first visit).
    models.catch(() => (models = null));
  }
  return models;
}

export async function detectFaces(image: HTMLCanvasElement): Promise<FaceDetection[]> {
  const { landmarker } = await loadDetector();
  const result = landmarker.detect(image);
  const W = image.width;
  const H = image.height;
  return result.faceLandmarks.map((lms): FaceDetection => {
    const pts = lms.map((p) => ({ x: p.x * W, y: p.y * H }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const box = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
    // Iris centres (468, 473), sorted so leftEye is on the left of the picture.
    const eyes = [pts[468], pts[473]].filter(Boolean).sort((a, b) => a.x - b.x);
    return {
      box,
      leftEye: eyes.length === 2 ? eyes[0] : undefined,
      rightEye: eyes.length === 2 ? eyes[1] : undefined,
      score: 1,
      landmarks: pts,
    };
  });
}

/**
 * Person mask for a region around the face. Segmenting just this region
 * (not the whole photo) gives the model more pixels of hair to work with.
 */
export async function segmentPerson(image: HTMLCanvasElement, region: Box): Promise<PersonMask> {
  const { segmenter } = await loadDetector();
  const side = 512;
  const c = document.createElement('canvas');
  c.width = side;
  c.height = side;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(image, region.x, region.y, region.w, region.h, 0, 0, side, side);
  const result = segmenter.segment(c);
  try {
    const masks = result.confidenceMasks ?? [];
    // The selfie model has one "person" mask; if there are two, the last one is the person.
    const m = masks[masks.length - 1];
    if (!m) throw new Error('No person mask');
    return { conf: m.getAsFloat32Array().slice(), width: m.width, height: m.height, region };
  } finally {
    result.close();
  }
}
