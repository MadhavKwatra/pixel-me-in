/**
 * Step 2: find the face with MediaPipe Face Detector.
 * The model and WASM runtime are served from this site (public/mediapipe/),
 * and inference runs on the player's CPU. No image data is sent anywhere.
 */
import type { FaceDetector } from '@mediapipe/tasks-vision';
import type { FaceDetection } from './geometry';

let detector: Promise<FaceDetector> | null = null;

/** Load once, lazily: the runtime is ~13 MB, so only the photo screen pays for it. */
export function loadDetector(): Promise<FaceDetector> {
  if (!detector) {
    detector = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const base = new URL('mediapipe/', document.baseURI).href;
      const fileset = await FilesetResolver.forVisionTasks(base + 'wasm');
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: base + 'models/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    })();
    // Let a later call retry if loading failed (e.g. offline on first visit).
    detector.catch(() => (detector = null));
  }
  return detector;
}

export async function detectFaces(image: HTMLCanvasElement): Promise<FaceDetection[]> {
  const d = await loadDetector();
  const result = d.detect(image);
  const W = image.width;
  const H = image.height;
  return result.detections.flatMap((det): FaceDetection[] => {
    const bb = det.boundingBox;
    if (!bb) return [];
    // Keypoints are normalized (0..1). 0 and 1 are the eyes.
    const eyes = det.keypoints
      .slice(0, 2)
      .map((k) => ({ x: k.x * W, y: k.y * H }))
      .sort((a, b) => a.x - b.x);
    return [
      {
        box: { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height },
        leftEye: eyes.length === 2 ? eyes[0] : undefined,
        rightEye: eyes.length === 2 ? eyes[1] : undefined,
        score: det.categories[0]?.score ?? 0,
      },
    ];
  });
}
