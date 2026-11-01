/**
 * Touch gestures for one-handed play (pure logic, tested in tests/gestures.test.ts):
 * - tap anywhere          = jump (tap again in the air = double jump)
 * - swipe up              = jump
 * - swipe down (and hold) = slide; in the air it drops you fast
 * A jump from a gesture is always a full jump (no "let go early" short hop).
 */
export type GameInput = 'jumpTap' | 'jumpDown' | 'jumpUp' | 'slideDown' | 'slideUp';

/** Finger travel (CSS px) that counts as a swipe. */
export const SWIPE_PX = 24;
/** A tap must be shorter than this. */
export const TAP_MS = 300;

interface Touch {
  x: number;
  y: number;
  t: number;
  mode: 'pending' | 'slide' | 'jump';
}

export class GestureTracker {
  private touches = new Map<number, Touch>();

  down(id: number, x: number, y: number, t: number): GameInput[] {
    this.touches.set(id, { x, y, t, mode: 'pending' });
    return [];
  }

  move(id: number, _x: number, y: number): GameInput[] {
    const tc = this.touches.get(id);
    if (!tc || tc.mode !== 'pending') return [];
    const dy = y - tc.y;
    if (dy > SWIPE_PX) {
      tc.mode = 'slide';
      return ['slideDown'];
    }
    if (dy < -SWIPE_PX) {
      tc.mode = 'jump';
      return ['jumpTap'];
    }
    return [];
  }

  up(id: number, x: number, y: number, t: number): GameInput[] {
    const tc = this.touches.get(id);
    this.touches.delete(id);
    if (!tc) return [];
    if (tc.mode === 'slide') return ['slideUp'];
    if (tc.mode === 'jump') return [];
    const moved = Math.hypot(x - tc.x, y - tc.y);
    if (t - tc.t < TAP_MS && moved < SWIPE_PX) return ['jumpTap'];
    return [];
  }

  cancel(id: number): GameInput[] {
    const tc = this.touches.get(id);
    this.touches.delete(id);
    return tc?.mode === 'slide' ? ['slideUp'] : [];
  }
}
