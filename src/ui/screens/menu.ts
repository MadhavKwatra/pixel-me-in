import { GAME_NAME } from '../../config';
import { CREATOR } from '../../creator';
import { renderCharacter } from '../../face/renderAvatar';
import { getStats } from '../../storage/local';
import type { Screen } from '../app';
import { formatNumber, onActions, render, toast } from '../dom';
import { installAvailable, promptInstall } from '../pwa';

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

export const menuScreen: Screen = (app, root) => {
  const stats = getStats();
  render(
    root,
    `<div class="panel">
      <h2>${GAME_NAME}</h2>
      <div class="menu-grid">
        <canvas class="preview" width="1" height="1" aria-label="Your character"></canvas>
        <div class="stack">
          <button class="btn btn-big" data-action="play" autofocus>▶ Play</button>
          <button class="btn btn-teal" data-action="booth">Photo Booth</button>
          <div class="row">
            <button class="btn btn-ghost" data-action="howto">How to play</button>
            <button class="btn btn-ghost" data-action="settings">Settings</button>
          </div>
          ${installAvailable() ? '<button class="btn btn-ghost" data-action="install">Install app</button>' : ''}
          <button class="btn btn-ghost" data-action="exit">Exit</button>
        </div>
      </div>
      <p class="note center">Best: ${formatNumber(stats.best)} m · Gears: ${formatNumber(stats.totalGears)} · Runs: ${stats.runs}${app.debug ? ' · DEBUG ON' : ''}</p>
      <p class="note center">Made by <a href="${CREATOR.portfolio}" target="_blank" rel="noopener">${CREATOR.name}</a></p>
    </div>`,
  );

  if (app.base && app.avatar) {
    const preview = root.querySelector<HTMLCanvasElement>('canvas.preview')!;
    const ch = renderCharacter(app.base, app.avatar, 3);
    preview.width = ch.width;
    preview.height = ch.height;
    preview.getContext('2d')!.drawImage(ch, 0, 0);
  }

  onActions(root, {
    play: () => void app.play(),
    booth: () => app.go('editor'),
    howto: () => {
      app.backTo = 'menu';
      app.go('howto');
    },
    settings: () => {
      app.backTo = 'menu';
      app.go('settings');
    },
    install: () => void promptInstall(),
    exit: () => history.back(),
  });

  // Secret developer view: the Konami code.
  let pos = 0;
  const onKey = (e: KeyboardEvent) => {
    pos = e.key === KONAMI[pos] ? pos + 1 : e.key === KONAMI[0] ? 1 : 0;
    if (pos === KONAMI.length) {
      pos = 0;
      app.debug = !app.debug;
      toast(app.debug ? 'Debug view ON (hitboxes, FPS)' : 'Debug view OFF');
      app.go('menu');
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
};
