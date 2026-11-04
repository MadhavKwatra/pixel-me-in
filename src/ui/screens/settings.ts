import { applyStatsSetting } from '../../analytics';
import { clearAllData } from '../../face/faceStore';
import { downloadFaceFinder, faceFinderReady } from '../../face/offline';
import { getSettings, setSettings, type Settings } from '../../storage/local';
import type { Screen } from '../app';
import { isTouch } from '../device';
import { feedbackHtml, wireFeedback } from '../feedback';
import { onActions, render, toast } from '../dom';
import { updatePad } from '../touchControls';

const TOGGLES: [keyof Settings, string, string][] = [
  ['muted', 'Mute all sound', ''],
  ['music', 'Music', 'Chiptune music while you run.'],
  ['reducedMotion', 'Reduce motion', 'No screen shake, no flashes, calmer effects.'],
  ['slowMode', 'Slow mode', 'The game runs 25% slower. Easier to react.'],
  ['vibration', 'Vibrate on crash', 'Android phones only.'],
  [
    'stats',
    'Share anonymous play stats',
    'No cookies, never your photo. Helps the maker see what to improve.',
  ],
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
        ${
          isTouch()
            ? `<label class="toggle"><span>Touch buttons<br><span class="note">Jump/Slide buttons on screen. Gestures always work: tap = jump, swipe down = slide.</span></span>
          <select data-touch-buttons>
            <option value="auto" ${s.touchButtons === 'auto' ? 'selected' : ''}>Upright only</option>
            <option value="always" ${s.touchButtons === 'always' ? 'selected' : ''}>Always</option>
            <option value="never" ${s.touchButtons === 'never' ? 'selected' : ''}>Never</option>
          </select></label>`
            : ''
        }
        <label class="toggle"><span>Debug view<br><span class="note">Hitboxes and FPS. For developers.</span></span>
          <input type="checkbox" data-debug ${app.debug ? 'checked' : ''} /></label>
        <h3>Offline</h3>
        <div class="toggle"><span>Offline Photo Booth<br><span class="note" data-offline-note>Checking…</span></span>
          <button class="btn btn-ghost hidden" data-offline-get>Download (17 MB)</button></div>
        <h3>Your data</h3>
        <p class="note">Your face crop, character, scores and settings are stored only in this browser.</p>
        <button class="btn btn-red" data-action="delete">Delete my data</button>
        <h3>More</h3>
        <div class="row">
          <a class="btn btn-ghost" href="./how-to-play.html">How to play</a>
          <a class="btn btn-ghost" href="./privacy.html">Privacy</a>
          <a class="btn btn-ghost" href="./about.html">About</a>
        </div>
        <h3>Feedback &amp; contact</h3>
        ${feedbackHtml()}
        <button class="btn btn-ghost" data-action="back" autofocus>Back</button>
      </div>
    </div>`,
  );

  wireFeedback(root);
  const note = root.querySelector<HTMLElement>('[data-offline-note]')!;
  const get = root.querySelector<HTMLButtonElement>('[data-offline-get]')!;
  const showOffline = (ready: boolean) => {
    note.textContent = ready
      ? 'Ready ✓ – photos work with no connection.'
      : 'The face finder downloads the first time you take a photo.';
    get.classList.toggle('hidden', ready);
  };
  void faceFinderReady().then(showOffline, () => showOffline(false));
  get.addEventListener('click', async () => {
    get.disabled = true;
    get.textContent = 'Downloading…';
    const ok = await downloadFaceFinder();
    get.disabled = false;
    get.textContent = 'Download (17 MB)';
    showOffline(ok);
    if (!ok) toast('Could not download – check your connection.');
  });
  root.querySelector<HTMLSelectElement>('[data-touch-buttons]')?.addEventListener('change', (e) => {
    setSettings({
      touchButtons: (e.target as HTMLSelectElement).value as Settings['touchButtons'],
    });
    updatePad();
  });
  root.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((input) =>
    input.addEventListener('change', () => {
      const k = input.dataset.k as keyof Settings;
      setSettings({ [k]: input.checked });
      if (k === 'muted' || k === 'music') app.applySoundSettings();
      if (k === 'reducedMotion') app.applyMotionSetting();
      if (k === 'stats') applyStatsSetting();
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
