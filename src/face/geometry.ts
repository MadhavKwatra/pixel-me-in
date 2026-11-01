/**
 * Pure math for turning a detected face into a level, centred square crop.
 * No DOM here, so it is unit-tested in tests/geometry.test.ts.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A face found in a source image. All values are in source-image pixels. */
export interface FaceDetection {
  box: Box;
  /** The eye on the left side of the image (the person's right eye). */
  leftEye?: Point;
  /** The eye on the right side of the image. */
  rightEye?: Point;
  score: number;
}

/**
 * How to cut the face out of the source image.
 * The crop is a square of `side` source pixels, centred on (cx, cy),
 * rotated by `angle` radians so the eyes end up level.
 */
export interface CropTransform {
  cx: number;
  cy: number;
  side: number;
  angle: number;
}

/**
 * Where things land in the normalized face square, as fractions (0..1).
 * Accessories (hats, masks, glasses) are drawn at these anchors, which is why
 * they fit every face without any extra AI.
 */
export const ANCHORS = {
  eyeY: 0.46,
  /** Distance between the eyes as a fraction of the crop side. */
  eyeSpan: 0.3,
  mouthY: 0.72,
  /** Top of the head (roughly where the hair starts). */
  crownY: 0.12,
} as const;

/** Pick the biggest face (closest to the camera). */
export function pickMainFace(faces: FaceDetection[]): FaceDetection | undefined {
  let best: FaceDetection | undefined;
  for (const f of faces) {
    if (!best || f.box.w * f.box.h > best.box.w * best.box.h) best = f;
  }
  return best;
}

/** Build the crop for a detected face. */
export function cropFromDetection(face: FaceDetection): CropTransform {
  const { leftEye, rightEye, box } = face;
  if (leftEye && rightEye) {
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const eyeDist = Math.hypot(dx, dy);
    if (eyeDist > 1) {
      const angle = Math.atan2(dy, dx);
      const side = eyeDist / ANCHORS.eyeSpan;
      const mid = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
      // Move from the eye midpoint to the crop centre, along the face's own "down" axis.
      const down = (0.5 - ANCHORS.eyeY) * side;
      return {
        cx: mid.x - Math.sin(angle) * down,
        cy: mid.y + Math.cos(angle) * down,
        side,
        angle,
      };
    }
  }
  // No usable eyes: fall back to the box, with room for hair above.
  const side = Math.max(box.w, box.h) * 1.6;
  return { cx: box.x + box.w / 2, cy: box.y + box.h * 0.42, side, angle: 0 };
}

/** A centred square crop, used when no face is found (the player adjusts it by hand). */
export function defaultCrop(width: number, height: number): CropTransform {
  return { cx: width / 2, cy: height / 2, side: Math.min(width, height) * 0.8, angle: 0 };
}

/**
 * Map a point in the output square (0..size) back to source-image pixels.
 * The canvas drawing in normalizeFace.ts applies the inverse of this.
 */
export function outputToSource(t: CropTransform, size: number, p: Point): Point {
  const s = t.side / size;
  const u = (p.x - size / 2) * s;
  const v = (p.y - size / 2) * s;
  const cos = Math.cos(t.angle);
  const sin = Math.sin(t.angle);
  return { x: t.cx + u * cos - v * sin, y: t.cy + u * sin + v * cos };
}
