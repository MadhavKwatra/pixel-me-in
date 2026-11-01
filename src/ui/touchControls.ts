/**
 * Touch controls during a run: gestures on the whole game area, plus an
 * optional on-screen pad (Jump / Slide buttons). Setting "Touch buttons":
 * auto (portrait only), always, never.
 */
import { sendInput } from '../game/controller';
import { getSettings } from '../storage/local';
import { isPortrait, isTouch } from './device';
import { GestureTracker, type GameInput } from './gestures';

export function padVisible(): boolean {
  if (!isTouch()) return false;
  const mode = getSettings().touchButtons;
  return mode === 'always' || (mode === 'auto' && isPortrait());
}

/** Attach gestures to `surface` and show/hide the pad in `padEl`. Returns a detach function. */
export function attachTouchControls(surface: HTMLElement, padEl: HTMLElement): () => void {
  const tracker = new GestureTracker();
  const send = (list: GameInput[]) => list.forEach(sendInput);
  const touchOnly = (e: PointerEvent) => e.pointerType === 'touch' || e.pointerType === 'pen';

  const down = (e: PointerEvent) => {
    if (!touchOnly(e)) return;
    surface.setPointerCapture?.(e.pointerId);
    send(tracker.down(e.pointerId, e.clientX, e.clientY, e.timeStamp));
  };
  const move = (e: PointerEvent) =>
    touchOnly(e) && send(tracker.move(e.pointerId, e.clientX, e.clientY));
  const up = (e: PointerEvent) =>
    touchOnly(e) && send(tracker.up(e.pointerId, e.clientX, e.clientY, e.timeStamp));
  const cancel = (e: PointerEvent) => touchOnly(e) && send(tracker.cancel(e.pointerId));
  surface.addEventListener('pointerdown', down);
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerup', up);
  surface.addEventListener('pointercancel', cancel);

  // On-screen pad: real buttons (hold Jump for a higher jump, hold Slide to keep sliding).
  padEl.innerHTML = `
    <button class="pad-btn pad-slide" aria-label="Slide" data-in="slide"><span aria-hidden="true">▼</span>Slide</button>
    <button class="pad-btn pad-jump" aria-label="Jump" data-in="jump"><span aria-hidden="true">▲</span>Jump</button>`;
  const press = (e: PointerEvent) => {
    const kind = (e.currentTarget as HTMLElement).dataset.in;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    (e.currentTarget as HTMLElement).classList.add('down');
    sendInput(kind === 'jump' ? 'jumpDown' : 'slideDown');
  };
  const release = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (!el.classList.contains('down')) return;
    el.classList.remove('down');
    sendInput(el.dataset.in === 'jump' ? 'jumpUp' : 'slideUp');
  };
  padEl.querySelectorAll<HTMLElement>('.pad-btn').forEach((b) => {
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  const refresh = () => padEl.classList.toggle('hidden', !padVisible());
  refresh();
  const mq = matchMedia('(orientation: portrait)');
  mq.addEventListener('change', refresh);

  return () => {
    surface.removeEventListener('pointerdown', down);
    surface.removeEventListener('pointermove', move);
    surface.removeEventListener('pointerup', up);
    surface.removeEventListener('pointercancel', cancel);
    mq.removeEventListener('change', refresh);
    padEl.innerHTML = '';
    padEl.classList.add('hidden');
  };
}
