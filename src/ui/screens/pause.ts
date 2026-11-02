import type { Screen } from '../app';
import { getSettings, setSettings, type Settings } from '../../storage/local';
import { isTouch } from '../device';
import { onActions, render } from '../dom';
import { updatePad } from '../touchControls';

export const pauseScreen: Screen = (app, root) => {
  const mode = getSettings().touchButtons;
  const opt = (v: Settings['touchButtons'], label: string) =>
    `<option value="${v}" ${mode === v ? 'selected' : ''}>${label}</option>`;
  render(
    root,
    `<div class="panel center">
      <h2>Paused</h2>
      <div class="stack">
        <button class="btn btn-big" data-action="resume" autofocus>▶ Resume</button>
        <button class="btn" data-action="restart">Restart</button>
        ${
          isTouch()
            ? `<label class="toggle"><span>Touch buttons</span>
          <select data-touch-buttons>${opt('auto', 'Upright only')}${opt('always', 'Always')}${opt('never', 'Never')}</select></label>`
            : ''
        }
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
  root.querySelector<HTMLSelectElement>('[data-touch-buttons]')?.addEventListener('change', (e) => {
    setSettings({
      touchButtons: (e.target as HTMLSelectElement).value as Settings['touchButtons'],
    });
    updatePad();
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') app.resume();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
};
