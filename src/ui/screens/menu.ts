import { formatGB } from '../../game/rules';
import { GAME_NAME } from '../../config';
import { getSettings, getStats } from '../../storage/local';
import { characterFrames, startMiniScene } from '../miniScene';
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
    `<div class="panel title-screen">
      <button class="icon-btn exit-btn" data-action="exit" aria-label="Exit the game" title="Exit">✕</button>
      <h2 class="game-title">${GAME_NAME}</h2>
      <div class="title-scene"><canvas aria-label="Your character running"></canvas><div class="scan" aria-hidden="true"></div></div>
      <div class="stack">
        <button class="btn btn-big" data-action="play" autofocus>Play</button>
        <div class="row center">
          <button class="btn btn-teal" data-action="booth">Photo Booth</button>
          <button class="btn btn-ghost" data-action="howto">How to play</button>
          <button class="btn btn-ghost" data-action="settings">Settings</button>
        </div>
        ${installAvailable() ? '<button class="btn btn-ghost" data-action="install">Install app</button>' : ''}
      </div>
      <dl class="stats">
        <div><dt>Best</dt><dd>${formatNumber(stats.best)} m</dd></div>
        <div><dt>RAM saved</dt><dd>${formatGB(stats.totalGears)}</dd></div>
        <div><dt>Runs</dt><dd>${stats.runs}</dd></div>
      </dl>
      ${app.debug ? '<p class="note center">Debug view is on</p>' : ''}
    </div>`,
  );

  const stop =
    app.base && app.avatar
      ? startMiniScene(
          root.querySelector<HTMLCanvasElement>('.title-scene canvas')!,
          characterFrames(app.base, app.avatar),
          getSettings().reducedMotion,
        )
      : () => {};

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
  return () => {
    stop();
    window.removeEventListener('keydown', onKey);
  };
};
