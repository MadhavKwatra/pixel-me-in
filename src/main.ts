/**
 * Entry point of the landing page. The page itself is plain HTML; the game
 * (Phaser, MediaPipe) only loads when the player presses Play, so the page
 * stays fast.
 */
import { getSettings } from './storage/local';
import { $, onActions } from './ui/dom';
import { showLoader } from './ui/loader';
import { defaultCharacter, startMiniScene } from './ui/miniScene';
import { setupNav } from './ui/nav';
import { promptInstall, setupPwa } from './ui/pwa';

setupPwa();
setupNav();

// Phones: a sticky "Play now" bar appears once the hero's Play button scrolls away.
{
  const bar = document.querySelector<HTMLElement>('.sticky-play');
  const heroPlay = document.querySelector('.hero [data-action="play"]');
  if (bar && heroPlay && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => bar.classList.toggle('show', !e.isIntersecting)).observe(
      heroPlay,
    );
  }
}

// The tablet in the hero shows a ready-made character running (no photo needed).
{
  const { face, cfg } = defaultCharacter();
  startMiniScene($<HTMLCanvasElement>('#hero-canvas'), face, cfg, getSettings().reducedMotion);
}

let appPromise: Promise<import('./ui/app').App> | null = null;

async function openApp() {
  // Show the loading screen at once: the game code is still downloading.
  const loader = showLoader(document.body, 'Booting the digitizer…');
  loader.element.classList.add('loader-fixed');
  try {
    // Load the game code on demand (code splitting).
    appPromise ??= import('./ui/app').then(({ App }) => new App());
    const app = await appPromise;
    await app.open();
  } finally {
    loader.close();
  }
}

onActions($('#landing'), {
  play: () => void openApp(),
  install: () => void promptInstall(),
});

// Deep link: /?play opens the game directly (used by the "Play" link on every page and the portfolio).
if (new URLSearchParams(location.search).has('play')) void openApp();
