import type { Screen } from '../app';
import { onActions, render } from '../dom';

export const pauseScreen: Screen = (app, root) => {
  render(
    root,
    `<div class="panel center">
      <h2>Paused</h2>
      <div class="stack">
        <button class="btn btn-big" data-action="resume" autofocus>▶ Resume</button>
        <button class="btn" data-action="restart">Restart</button>
        <div class="row center">
          <button class="btn btn-ghost" data-action="howto">How to play</button>
          <button class="btn btn-ghost" data-action="settings">Settings</button>
        </div>
        <button class="btn btn-ghost" data-action="menu">Quit to menu</button>
      </div>
    </div>`,
  );
  onActions(root, {
    resume: () => app.resume(),
    restart: () => void app.play(),
    howto: () => {
      app.backTo = 'pause';
      app.go('howto');
    },
    settings: () => {
      app.backTo = 'pause';
      app.go('settings');
    },
    menu: () => app.quitToMenu(),
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') app.resume();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
};
