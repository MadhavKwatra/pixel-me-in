/**
 * How much of the world the camera shows, for any screen shape (pure math,
 * tested in tests/gestures.test.ts). The game fills the whole screen:
 * - landscape: the ground band (0..360) fits the height; wide phones see further ahead;
 *   screens narrower than 16:9 show extra sky instead of less road.
 * - portrait: about 420 world px across; the ground sits ~64 % down, with sky
 *   above and dirt below.
 */
import { GROUND_Y } from '../art/world';

export const LANDSCAPE_MIN_W = 640;
export const PORTRAIT_W = 420;
const WORLD_H = 360;

export interface View {
  /** Camera zoom: screen pixels per world pixel. */
  zoom: number;
  /** World rectangle the camera shows. */
  left: number;
  top: number;
  width: number;
  height: number;
  portrait: boolean;
}

export function computeView(screenW: number, screenH: number): View {
  const portrait = screenH > screenW;
  if (portrait) {
    const zoom = screenW / PORTRAIT_W;
    const height = screenH / zoom;
    return { zoom, left: 0, top: GROUND_Y - 0.64 * height, width: PORTRAIT_W, height, portrait };
  }
  const zoom = Math.min(screenH / WORLD_H, screenW / LANDSCAPE_MIN_W);
  const width = screenW / zoom;
  const height = screenH / zoom;
  // Keep the bottom of the world (ground) at the bottom of the screen.
  return { zoom, left: 0, top: WORLD_H - height, width, height, portrait };
}

/** Where the runner stands: a bit left of the middle, never too far right on narrow screens. */
export function playerX(view: View): number {
  return Math.round(Math.min(150, view.width * 0.26));
}
