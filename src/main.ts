/**
 * Entry point. The landing page is plain HTML; the game (Phaser, MediaPipe)
 * only loads when the player presses Play, so the page itself stays fast.
 */
import { DEFAULT_AVATAR } from './face/faceStore';
import { canvasToPixels } from './face/canvas';
import { drawPreset } from './face/presets';
import { renderCharacter } from './face/renderAvatar';
import { $, onActions } from './ui/dom';
import { promptInstall, setupPwa } from './ui/pwa';

setupPwa();

// Hero picture: a ready-made character (no photo needed for the landing page).
{
  const hero = $<HTMLCanvasElement>('#hero-canvas');
  const ch = renderCharacter(
    canvasToPixels(drawPreset(1)),
    { ...DEFAULT_AVATAR, presetId: 1, hat: 'cap' },
    4,
  );
  hero.width = ch.width;
  hero.height = ch.height;
  hero.getContext('2d')!.drawImage(ch, 0, 0);
}

let appPromise: Promise<import('./ui/app').App> | null = null;

async function openApp() {
  // Load the game code on demand (code splitting).
  appPromise ??= import('./ui/app').then(({ App }) => new App());
  const app = await appPromise;
  await app.open();
}

onActions($('#landing'), {
  play: () => void openApp(),
  install: () => void promptInstall(),
});

// Deep link: /?play opens the game directly (handy for the portfolio).
if (new URLSearchParams(location.search).has('play')) void openApp();
