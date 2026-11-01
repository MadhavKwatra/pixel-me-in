import { FACE_ACCESSORIES, HATS } from '../../face/accessories';
import { OUTFIT_LABELS } from '../../art/body';
import type { GameOverData } from '../../game/events';
import { getStats, recordRun } from '../../storage/local';
import { isUnlocked, UNLOCK_RULES } from '../../storage/unlocks';
import { FEEDBACK_URL } from '../../creator';
import type { Screen } from '../app';
import { wireFeedback } from '../feedback';
import { isTouch } from '../device';
import { formatNumber, onActions, render } from '../dom';
import { openShareSheet } from '../shareSheet';

const NAMES: Record<string, string> = {
  ...Object.fromEntries(HATS.map((h) => [h.id, h.label])),
  ...Object.fromEntries(FACE_ACCESSORIES.map((a) => [a.id, a.label])),
  ...OUTFIT_LABELS,
};

export const gameOverScreen: Screen = (app, root, arg) => {
  const d = arg as GameOverData;
  const before = getStats();
  const { stats, newBest } = recordRun(d.metres, d.gears);
  const friend = Number(sessionStorage.getItem('pmi:beat')) || 0;
  const unlocked = Object.keys(UNLOCK_RULES).filter(
    (id) => !isUnlocked(id, before) && isUnlocked(id, stats),
  );

  render(
    root,
    `<div class="panel center">
      <h2>Zapped out!</h2>
      <p style="font-size:1.6rem;margin:0.2rem 0"><strong>${formatNumber(d.metres)} m</strong></p>
      <p>${newBest ? '🏆 New best!' : `Best: ${formatNumber(stats.best)} m`} · ⚙ ${d.gears} gears</p>
      ${friend ? `<p class="challenge-result">${d.metres > friend ? `🎉 You beat your friend's ${formatNumber(friend)} m!` : `Your friend ran ${formatNumber(friend)} m – ${formatNumber(friend - d.metres + 1)} m to go!`}</p>` : ''}
      ${unlocked.length ? `<p role="status">🔓 Unlocked in the Photo Booth: <strong>${unlocked.map((id) => NAMES[id] ?? id).join(', ')}</strong></p>` : ''}
      <div class="stack">
        <button class="btn btn-big" data-action="again" autofocus>Run again</button>
        <div class="row center">
          <button class="btn btn-teal" data-action="share">Challenge friends</button>
        </div>
        <div class="row center">
          <button class="btn btn-ghost" data-action="booth">Photo Booth</button>
          <button class="btn btn-ghost" data-action="menu">Menu</button>
        </div>
      </div>
      ${stats.runs >= 3 ? `<p class="note thanks">Enjoying it? <button class="linklike" data-share-game>Share the game</button>${FEEDBACK_URL ? ` or <a href="${FEEDBACK_URL}" target="_blank" rel="noopener">send feedback</a>` : ''}.</p>` : ''}
      ${isTouch() ? '' : '<p class="note">Tip: press Space or Enter to run again.</p>'}
    </div>`,
  );

  wireFeedback(root);
  onActions(root, {
    again: () => void app.play(),
    share: () => openShareSheet(root, app.base!, app.avatar!, d),
    booth: () => app.go('editor'),
    menu: () => app.quitToMenu(),
  });

  // Small delay so a jump key still held from the crash does not restart instantly.
  const armedAt = performance.now() + 600;
  const onKey = (e: KeyboardEvent) => {
    if (performance.now() < armedAt) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      void app.play();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
};
