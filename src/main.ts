/**
 * Entry point of the landing page. The page itself is plain HTML; the game
 * (Phaser, MediaPipe) only loads when the player presses Play, so the page
 * stays fast.
 */
import { initAnalytics, track } from './analytics';
import { getSettings } from './storage/local';
import { $, onActions } from './ui/dom';
import { showLoader } from './ui/loader';
import { characterFrames, defaultCharacter, sliceSheet, startMiniScene } from './ui/miniScene';
import { setupNav } from './ui/nav';
import { promptInstall, setupPwa } from './ui/pwa';

setupPwa();
setupNav();
initAnalytics();

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

// The tablet shows the maker's own pixel character (public/brand/creator-run.png, used
// with his consent). If it cannot load, a ready-made character runs instead.
{
  const canvas = $<HTMLCanvasElement>('#hero-canvas');
  const reduced = getSettings().reducedMotion;
  const img = new Image();
  img.onload = () => startMiniScene(canvas, sliceSheet(img, 8), reduced);
  img.onerror = () => {
    const { face, cfg } = defaultCharacter();
    startMiniScene(canvas, characterFrames(face, cfg), reduced);
  };
  img.src = new URL('./brand/creator-run.png', document.baseURI).href;
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
  install: () => {
    track('install_clicked');
    void promptInstall();
  },
});

// Challenge link from a friend: ?beat=1234 (just a number in the link; nothing is sent).
{
  const beat = Math.floor(Number(new URLSearchParams(location.search).get('beat')));
  const el = document.querySelector<HTMLElement>('.challenge');
  if (el && beat > 0 && beat < 1_000_000) {
    sessionStorage.setItem('pmi:beat', String(beat));
    track('challenge_opened');
    el.textContent = `Your friend ran ${beat.toLocaleString('en-US')} m. Can you beat it?`;
    el.classList.remove('hidden');
  }
}

// Deep link: /?play opens the game directly (used by the "Play" link on every page and the portfolio).
if (new URLSearchParams(location.search).has('play')) void openApp();
