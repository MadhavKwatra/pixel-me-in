/** Who made the game, and how players can reach him. Shown on the pages, in Settings and in search-engine data. */
export const CREATOR = {
  name: 'Madhav Kwatra',
  firstName: 'Madhav',
  portfolio: 'https://madhavkwatra.in',
  github: 'https://github.com/MadhavKwatra',
  linkedin: 'https://www.linkedin.com/in/madhav-kwatra/',
  x: 'https://x.com/madhav_kwatra',
  instagram: 'https://www.instagram.com/iammadhavkwatra',
} as const;

/**
 * Feedback form for players (Tally or Google Forms – a plain link, nothing is
 * sent by the game). Empty = the "Send feedback" button is hidden.
 */
export const FEEDBACK_URL = '';

/** Public repository (empty = GitHub links are hidden). */
export const REPO_URL = 'https://github.com/MadhavKwatra/pixel-me-in';

/** Where the game lives. Used in share texts and links. */
export function gameUrl(): string {
  const u = new URL('./', location.href);
  return u.origin === 'null' ? location.href : u.href;
}
