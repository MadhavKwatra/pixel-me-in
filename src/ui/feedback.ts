/**
 * "Feedback & contact" block: feedback form, message me on socials, bug reports
 * for developers, and say thanks (share the game). Used on the About page, in
 * Settings and (short version) on the game-over screen. Only links – the game
 * sends nothing.
 */
import { CREATOR, FEEDBACK_URL, gameUrl, REPO_URL } from '../creator';
import { toast } from './dom';
import { icon, type IconName } from './icons';

const SOCIALS: [IconName, string, string][] = [
  ['linkedin', 'LinkedIn', CREATOR.linkedin],
  ['x', 'X', CREATOR.x],
  ['instagram', 'Instagram', CREATOR.instagram],
  ['globe', 'Portfolio', CREATOR.portfolio],
];

const ext = 'target="_blank" rel="noopener"';

export function socialLinksHtml(): string {
  return `<ul class="social">${SOCIALS.map(
    ([i, label, url]) =>
      `<li><a href="${url}" ${ext} aria-label="${label}" title="${label}">${icon(i, 22)}</a></li>`,
  ).join('')}</ul>`;
}

export function feedbackHtml(): string {
  return `
    <div class="feedback">
      ${FEEDBACK_URL ? `<a class="btn" href="${FEEDBACK_URL}" ${ext}>Send feedback</a>` : ''}
      <p><strong>Message me</strong> – ideas, bugs or just hi. I read everything.</p>
      ${socialLinksHtml()}
      <p><strong>Say thanks</strong> – share the game with a friend.</p>
      <div class="row">
        <button class="btn btn-teal" type="button" data-share-game>Share the game</button>
        ${REPO_URL ? `<a class="btn btn-ghost" href="${REPO_URL}" ${ext}>${icon('github', 18)} Star on GitHub</a>` : ''}
      </div>
      ${REPO_URL ? `<p class="small">Developer? <a href="${REPO_URL}/issues" ${ext}>Report a bug on GitHub</a>.</p>` : ''}
    </div>`;
}

/** Share the game link (phone share menu, or copy on desktop). */
export async function shareGame() {
  const url = gameUrl();
  const text = 'Put your face in a pixel-art game – free, and your photo stays on your phone.';
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Pixel Me In', text, url });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied – send it to a friend!');
  } catch {
    toast(url, undefined, 8000);
  }
}

/** Wire the share buttons inside `root` (call after rendering feedbackHtml). */
export function wireFeedback(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>('[data-share-game]')
    .forEach((b) => b.addEventListener('click', () => void shareGame()));
}
