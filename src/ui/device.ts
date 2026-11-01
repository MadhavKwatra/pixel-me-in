/** What kind of device are we on, and how is it held? */

export const isTouch = () =>
  matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

export const isPortrait = () => matchMedia('(orientation: portrait)').matches;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export const hasCamera = () => !!navigator.mediaDevices?.getUserMedia;

export const hasGamepad = () => Array.from(navigator.getGamepads?.() ?? []).some(Boolean);

/** Phones only: go full screen (Android). Any orientation is fine: upright or sideways. */
export async function enterGameMode(app: HTMLElement) {
  if (!isTouch()) return;
  try {
    if (!document.fullscreenElement && app.requestFullscreen)
      await app.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    /* not allowed here (e.g. iPhone Safari) – fine */
  }
}

export async function leaveGameMode() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
}
