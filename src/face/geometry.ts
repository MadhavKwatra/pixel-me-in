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
  /** All 478 face-mesh points (source pixels), when the Face Landmarker found them. */
  landmarks?: Point[];
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

/** Inverse of outputToSource: source-image pixels -> point in the output square. */
export function sourceToOutput(t: CropTransform, size: number, p: Point): Point {
  const dx = p.x - t.cx;
  const dy = p.y - t.cy;
  const cos = Math.cos(t.angle);
  const sin = Math.sin(t.angle);
  const s = size / t.side;
  return { x: size / 2 + (dx * cos + dy * sin) * s, y: size / 2 + (-dx * sin + dy * cos) * s };
}

// ---------------------------------------------------------------- face mesh

/**
 * Indices into MediaPipe's 478-point face mesh.
 * The face oval runs clockwise from the top of the forehead (10) to the chin (152) and back.
 */
export const MESH = {
  oval: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
    148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  ],
  irisA: 468,
  irisB: 473,
  browA: [70, 63, 105, 66, 107],
  browB: [336, 296, 334, 293, 300],
  mouthCornerA: 61,
  mouthCornerB: 291,
  lipTop: 13,
  lipBottom: 14,
  noseTip: 1,
  chin: 152,
  /** Widest points of the face (cheekbones / ears). */
  sideA: 234,
  sideB: 454,
} as const;

/**
 * Where the features are inside the normalized face square, as fractions (0..1).
 * Saved with the face so the pixel filter can sharpen eyes/mouth and so hats
 * and glasses sit in the right place on every head.
 */
export interface FaceMeta {
  eyeL: Point;
  eyeR: Point;
  browL: Point;
  browR: Point;
  mouthL: Point;
  mouthR: Point;
  /** Gap between the lips (open mouth / smile), as a fraction of the square. */
  mouthOpen: number;
  nose: Point;
  chin: Point;
  /** Bounding box of the visible head (hair included). */
  top: number;
  left: number;
  right: number;
  bottom: number;
  /** True when the background and neck were removed. */
  cut: boolean;
}

/** Meta for faces drawn at the fixed ANCHORS (ready-made characters, old saves). */
export function defaultMeta(): FaceMeta {
  const half = ANCHORS.eyeSpan / 2;
  return {
    eyeL: { x: 0.5 - half, y: ANCHORS.eyeY },
    eyeR: { x: 0.5 + half, y: ANCHORS.eyeY },
    browL: { x: 0.5 - half, y: ANCHORS.eyeY - 0.1 },
    browR: { x: 0.5 + half, y: ANCHORS.eyeY - 0.1 },
    mouthL: { x: 0.42, y: ANCHORS.mouthY - 0.04 },
    mouthR: { x: 0.58, y: ANCHORS.mouthY - 0.04 },
    mouthOpen: 0,
    nose: { x: 0.5, y: 0.6 },
    chin: { x: 0.5, y: 0.91 },
    top: 0.04,
    left: 0.12,
    right: 0.88,
    bottom: 0.92,
    cut: false,
  };
}

const avg = (pts: Point[]): Point => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

/**
 * Feature positions in the crop, from the face-mesh points (source pixels).
 * `bbox` is the visible head in source pixels (from the cut-out mask), if any.
 */
export function metaFromLandmarks(lm: Point[], t: CropTransform, bbox: Box | null): FaceMeta {
  const n = (p: Point) => {
    const o = sourceToOutput(t, 1, p);
    return { x: o.x, y: o.y };
  };
  const pick = (i: number) => n(lm[i]);
  let eyeL = pick(MESH.irisA);
  let eyeR = pick(MESH.irisB);
  let browL = n(avg(MESH.browA.map((i) => lm[i])));
  let browR = n(avg(MESH.browB.map((i) => lm[i])));
  let mouthL = pick(MESH.mouthCornerA);
  let mouthR = pick(MESH.mouthCornerB);
  // "L" always means the left side of the picture.
  if (eyeL.x > eyeR.x) [eyeL, eyeR] = [eyeR, eyeL];
  if (browL.x > browR.x) [browL, browR] = [browR, browL];
  if (mouthL.x > mouthR.x) [mouthL, mouthR] = [mouthR, mouthL];
  const top = pick(MESH.lipTop);
  const bottom = pick(MESH.lipBottom);

  let box: { top: number; left: number; right: number; bottom: number };
  if (bbox) {
    const corners = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.w, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.h },
      { x: bbox.x + bbox.w, y: bbox.y + bbox.h },
    ].map(n);
    box = {
      top: Math.min(...corners.map((c) => c.y)),
      bottom: Math.max(...corners.map((c) => c.y)),
      left: Math.min(...corners.map((c) => c.x)),
      right: Math.max(...corners.map((c) => c.x)),
    };
  } else {
    const oval = MESH.oval.map(pick);
    box = {
      top: Math.min(...oval.map((c) => c.y)) - 0.08,
      bottom: Math.max(...oval.map((c) => c.y)),
      left: Math.min(...oval.map((c) => c.x)),
      right: Math.max(...oval.map((c) => c.x)),
    };
  }
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    eyeL,
    eyeR,
    browL,
    browR,
    mouthL,
    mouthR,
    mouthOpen: Math.max(0, bottom.y - top.y),
    nose: pick(MESH.noseTip),
    chin: pick(MESH.chin),
    top: clamp(box.top),
    left: clamp(box.left),
    right: clamp(box.right),
    bottom: clamp(box.bottom),
    cut: !!bbox,
  };
}

/**
 * Crop around the visible head: square, a little padding, rotated so the eyes are level.
 * Filling the square with the head is what keeps small pixel sizes recognizable.
 */
export function cropFromHeadBox(box: Box, angle: number, pad = 1.06): CropTransform {
  return {
    cx: box.x + box.w / 2,
    cy: box.y + box.h / 2,
    side: Math.max(box.w, box.h) * pad,
    angle,
  };
}

/** Angle that makes the eyes level (0 if unknown). */
export function eyeAngle(face: FaceDetection): number {
  if (!face.leftEye || !face.rightEye) return 0;
  return Math.atan2(face.rightEye.y - face.leftEye.y, face.rightEye.x - face.leftEye.x);
}
