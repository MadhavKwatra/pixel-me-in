/**
 * Share sheet (game over + Photo Booth): the phone's own share menu, ready-made
 * links for X, Threads, WhatsApp, Facebook and LinkedIn, copy link, and saving
 * the picture (square or story size for Instagram). These are just links – the
 * game itself sends nothing anywhere.
 */
import { track } from '../analytics';
import { formatGB } from '../game/rules';
import { gameUrl } from '../creator';
import type { AvatarConfig } from '../face/faceStore';
import type { FaceData } from '../face/renderAvatar';
import { formatNumber, toast } from './dom';
import { icon, type IconName } from './icons';
import { canShareFiles, downloadCard, makeCard, shareCardFile, type Score } from './shareCard';

/** Link that challenges a friend: the landing page shows "Beat 1,234 m". */
export function challengeUrl(score?: Score): string {
  const u = new URL(gameUrl());
  if (score && score.metres > 0) u.searchParams.set('beat', String(Math.floor(score.metres)));
  return u.href;
}

function shareText(score?: Score): string {
  return score
    ? `I ran ${formatNumber(score.metres)} m and saved ${formatGB(score.gears)} of RAM from the data center in Pixel Me In – with my own face as the hero 😄 Can you beat me?`
    : 'I turned myself into pixel art in Pixel Me In 😄 Try it – your photo stays on your phone.';
}

const enc = encodeURIComponent;

export function socialLinks(score?: Score): [IconName, string, string][] {
  const url = challengeUrl(score);
  const text = shareText(score);
  return [
    ['x', 'X', `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`],
    ['threads', 'Threads', `https://www.threads.net/intent/post?text=${enc(`${text} ${url}`)}`],
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${enc(`${text} ${url}`)}`],
    ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ['linkedin', 'LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
  ];
}

/** Open the share sheet over the current screen. */
export function openShareSheet(
  host: HTMLElement,
  face: FaceData,
  cfg: AvatarConfig,
  score?: Score,
) {
  host.querySelector('.sheet')?.remove();
  track('share_opened', { from: score ? 'game_over' : 'booth' });
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Share');
  const native = canShareFiles();
  sheet.innerHTML = `
    <div class="sheet-panel">
      <div class="sheet-head">
        <h3>${score ? 'Challenge your friends' : 'Share your pixel self'}</h3>
        <button class="icon-btn" data-close aria-label="Close">✕</button>
      </div>
      ${native ? '<button class="btn btn-big" data-native>Share picture…</button><p class="note">Instagram, WhatsApp, Snapchat and more – from your phone\'s share menu.</p>' : ''}
      <div class="share-icons">
        ${socialLinks(score)
          .map(
            ([i, label, url]) =>
              `<a class="share-icon" href="${url}" target="_blank" rel="noopener" data-net="${i}" aria-label="Share on ${label}">${icon(i, 26)}<span>${label}</span></a>`,
          )
          .join('')}
        <button class="share-icon" data-copy aria-label="Copy link">${icon('link', 26)}<span>Copy link</span></button>
      </div>
      <h4>Save the picture</h4>
      <div class="row">
        <button class="btn" data-save="story">Story size</button>
        <button class="btn btn-ghost" data-save="square">Square</button>
      </div>
      <p class="note">Instagram: save the story picture, then add it to your story with the link sticker.</p>
    </div>`;
  host.append(sheet);
  const close = () => {
    sheet.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  sheet.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t === sheet || t.closest('[data-close]')) return close();
    const net =
      t.closest<HTMLElement>('[data-net]')?.dataset.net ??
      (t.closest('[data-native]') ? 'native' : t.closest('[data-copy]') ? 'copy' : undefined) ??
      t.closest<HTMLElement>('[data-save]')?.dataset.save;
    if (net) track('share_clicked', { to: net });
    if (t.closest('[data-native]')) {
      await shareCardFile(
        await makeCard(face, cfg, score, 'story'),
        `${shareText(score)} ${challengeUrl(score)}`,
      );
    }
    const save = t.closest<HTMLElement>('[data-save]')?.dataset.save;
    if (save === 'story' || save === 'square') {
      await downloadCard(await makeCard(face, cfg, score, save), `pixel-me-in-${save}.png`);
      toast('Picture saved.');
    }
    if (t.closest('[data-copy]')) {
      try {
        await navigator.clipboard.writeText(`${shareText(score)} ${challengeUrl(score)}`);
        toast('Copied – paste it anywhere!');
      } catch {
        toast(challengeUrl(score), undefined, 8000);
      }
    }
  });
  sheet.querySelector<HTMLElement>('[data-native], .share-icon')?.focus();
}
