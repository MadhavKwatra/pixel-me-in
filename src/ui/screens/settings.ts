import { setMuted } from '../../audio/sfx';
import { clearAllData } from '../../face/faceStore';
import { getSettings, setSettings, type Settings } from '../../storage/local';
import type { Screen } from '../app';
import { onActions, render, toast } from '../dom';

const TOGGLES: [keyof Settings, string, string][] = [
  ['muted', 'Mute sound', ''],
  ['reducedMotion', 'Reduce motion', 'No screen shake, no flashes, calmer effects.'],
  ['slowMode', 'Slow mode', 'The game runs 25% slower. Easier to react.'],
  ['vibration', 'Vibrate on crash', 'Android phones only.'],
];

export const settingsScreen: Screen = (app, root) => {
  const s = getSettings();
  render(
    root,
    `<div class="panel">
      <h2>Settings</h2>
      <div class="stack">
        ${TOGGLES.filter(([k]) => k !== 'vibration' || 'vibrate' in navigator)
          .map(
            ([
              k,
              label,
              help,
            ]) => `<label class="toggle"><span>${label}${help ? `<br><span class="note">${help}</span>` : ''}</span>
              <input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''} /></label>`,
          )
          .join('')}
        <label class="toggle"><span>Debug view<br><span class="note">Hitboxes and FPS. For developers.</span></span>
          <input type="checkbox" data-debug ${app.debug ? 'checked' : ''} /></label>
        <h3>Your data</h3>
        <p class="note">Your face crop, character, scores and settings are stored only in this browser.</p>
        <button class="btn btn-red" data-action="delete">Delete my data</button>
        <button class="btn btn-ghost" data-action="back" autofocus>Back</button>
      </div>
    </div>`,
  );

  root.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((input) =>
    input.addEventListener('change', () => {
      const k = input.dataset.k as keyof Settings;
      setSettings({ [k]: input.checked });
      if (k === 'muted') setMuted(input.checked);
      if (k === 'reducedMotion') app.applyMotionSetting();
    }),
  );
  root.querySelector<HTMLInputElement>('input[data-debug]')!.addEventListener('change', (e) => {
    app.debug = (e.target as HTMLInputElement).checked;
  });

  onActions(root, {
    delete: async () => {
      if (!confirm('Delete your face, character, scores and settings from this device?')) return;
      await clearAllData();
      await app.refreshAvatar();
      app.applyMotionSetting();
      toast('All your data was deleted.');
      app.go('photo');
    },
    back: () => app.go(app.backTo),
  });
};
