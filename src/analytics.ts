/**
 * Anonymous play stats, so the maker can see how the game is used.
 *
 * - Vercel Web Analytics: page visits, where people came from, device, country.
 * - PostHog (EU, cookieless): game steps like "run started" and "run finished".
 *
 * Privacy rules (see docs/PRIVACY.md):
 * - No cookies and nothing stored in the browser for stats. PostHog counts
 *   visitors with a hash on its server that changes every day.
 * - Everything goes to our own domain (`/_vercel/insights`, `/ph` – a Vercel
 *   rewrite to PostHog), so the CSP stays `connect-src 'self'`.
 * - Never a photo, face, name or free text. Only the small, fixed event list below.
 * - Off when the player turns it off in Settings, when the browser sends
 *   "Do Not Track" or "Global Privacy Control", in dev builds and in automated
 *   browsers (tests, video recordings). PostHog only runs when the build has
 *   `VITE_POSTHOG_KEY` (forks of the repo send nothing).
 */
import type { PostHog } from 'posthog-js';
import { getSettings } from './storage/local';

type Props = Record<string, string | number | boolean>;

/** The only events the game sends. */
export type StatEvent =
  | 'photo_scanned'
  | 'photo_used'
  | 'preset_picked'
  | 'booth_opened'
  | 'run_started'
  | 'run_finished'
  | 'tutorial_done'
  | 'share_opened'
  | 'share_clicked'
  | 'challenge_opened'
  | 'install_clicked';

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;

let posthog: PostHog | null = null;
let started = false;
const queue: [StatEvent, Props | undefined][] = [];

/** May stats be sent right now? */
export function statsAllowed(): boolean {
  if (!import.meta.env.PROD) return false;
  if (navigator.webdriver) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return false;
  return getSettings().stats;
}

/** Start both tools (once per page). Loads PostHog after the page is ready. */
export function initAnalytics() {
  if (started || !statsAllowed()) return;
  started = true;
  void import('@vercel/analytics').then(({ inject }) =>
    inject({ mode: 'production', beforeSend: (e) => (statsAllowed() ? e : null) }),
  );
  if (!KEY) return;
  const load = () =>
    void import('posthog-js').then(({ default: ph }) => {
      ph.init(KEY, {
        api_host: '/ph',
        ui_host: 'https://eu.posthog.com',
        cookieless_mode: 'always',
        persistence: 'memory',
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: true,
        disable_surveys: true,
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_performance: false,
        rageclick: false,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        respect_dnt: true,
      });
      posthog = ph;
      for (const [event, props] of queue.splice(0)) ph.capture(event, props);
    });
  if (document.readyState === 'complete') load();
  else window.addEventListener('load', load, { once: true });
}

/** Count one game step. Safe to call any time; does nothing when stats are off. */
export function track(event: StatEvent, props?: Props) {
  if (!statsAllowed()) return;
  if (posthog) posthog.capture(event, props);
  else if (KEY && queue.length < 50) queue.push([event, props]);
}

/** Called when the player switches stats off or on in Settings. */
export function applyStatsSetting() {
  if (!getSettings().stats) posthog?.opt_out_capturing();
  else if (posthog) posthog.opt_in_capturing();
  else initAnalytics();
}

/** Rough buckets, so no exact numbers are needed: 0, 1-99, 100-249, … */
export function bucket(n: number, steps: number[]): string {
  if (n <= 0) return '0';
  for (let i = 0; i < steps.length; i++)
    if (n < steps[i]) return `${i ? steps[i - 1] : 1}-${steps[i] - 1}`;
  return `${steps[steps.length - 1]}+`;
}

export const METRE_STEPS = [100, 250, 500, 1000, 2000, 5000];
export const GB_STEPS = [8, 16, 32, 64, 128, 256];
