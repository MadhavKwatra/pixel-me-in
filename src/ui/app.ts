/**
 * The app shell: opens/closes the full-screen game, switches screens, and
 * runs the Play flow. Screens live in ./screens/*.ts.
 */
import { pauseMusic, resumeMusic, setMusicEnabled, stopMusic } from '../audio/music';
import { setMuted, sfx, unlockAudio } from '../audio/sfx';
import { drawBodySheet } from '../art/body';
import { loadAvatar, type AvatarConfig } from '../face/faceStore';
import { headPivot, loadFace, renderHead, skinTone, type FaceData } from '../face/renderAvatar';
import {
  ensureGame,
  onGame,
  pauseRun,
  resumeRun,
  setAvatarTextures,
  startRun,
  stopRun,
} from '../game/controller';
import { EVENTS, type ChaseKind, type GameOverData } from '../game/events';
import { getSettings, setSettings } from '../storage/local';
import { enterGameMode, isPortrait, isTouch, leaveGameMode } from './device';
import { playDigitizer } from './digitizer';
import { $, toast } from './dom';
import { Hud } from './hud';
import { attachTouchControls } from './touchControls';
import { gameOverScreen } from './screens/gameOver';
import { editorScreen } from './screens/editor';
import { howToPlayScreen } from './screens/howToPlay';
import { menuScreen } from './screens/menu';
import { pauseScreen } from './screens/pause';
import { photoScreen } from './screens/photo';
import { settingsScreen } from './screens/settings';

export type ScreenName = 'menu' | 'photo' | 'editor' | 'howto' | 'settings' | 'pause' | 'gameover';

export type Screen = (app: App, root: HTMLElement, arg?: unknown) => void | (() => void);

const SCREENS: Record<ScreenName, Screen> = {
  menu: menuScreen,
  photo: photoScreen,
  editor: editorScreen,
  howto: howToPlayScreen,
  settings: settingsScreen,
  pause: pauseScreen,
  gameover: gameOverScreen,
};

export class App {
  readonly root = $('#app');
  readonly screenEl = $('#screen');
  readonly hud = new Hud($('#hud'));
  avatar: AvatarConfig | null = null;
  base: FaceData | null = null;
  debug = new URLSearchParams(location.search).has('debug');
  /** Where "Back" goes from Settings / How to play. */
  backTo: ScreenName = 'menu';
  current: ScreenName | null = null;
  private cleanup: (() => void) | void = undefined;
  private wired = false;
  private running = false;
  private introShown = false;

  async open(first: ScreenName = 'menu') {
    unlockAudio();
    this.applySoundSettings();
    this.applyMotionSetting();
    document.body.classList.add('in-app');
    this.root.classList.remove('hidden');
    history.pushState({ app: true }, '');
    await ensureGame($('#game'));
    this.wireGameEvents();
    await this.refreshAvatar();
    this.go(this.avatar ? first : 'photo');
  }

  close() {
    this.detachTouch();
    stopRun();
    this.running = false;
    this.hud.hide();
    this.go(null);
    this.root.classList.add('hidden');
    document.body.classList.remove('in-app');
    void leaveGameMode();
  }

  go(name: ScreenName | null, arg?: unknown) {
    if (typeof this.cleanup === 'function') this.cleanup();
    this.cleanup = undefined;
    this.screenEl.replaceChildren();
    this.current = name;
    if (!name) return;
    // A fresh element per screen, so old click listeners go away with it.
    const el = document.createElement('div');
    el.className = 'screen-root';
    this.screenEl.append(el);
    this.cleanup = SCREENS[name](this, el, arg);
    // Move keyboard focus into the new screen for keyboard and screen-reader users.
    el.querySelector<HTMLElement>('[autofocus], button, input')?.focus();
  }

  async refreshAvatar() {
    this.avatar = (await loadAvatar()) ?? null;
    this.base = this.avatar ? await loadFace(this.avatar) : null;
  }

  applySoundSettings() {
    const s = getSettings();
    setMuted(s.muted);
    setMusicEnabled(s.music && !s.muted);
  }

  applyMotionSetting() {
    document.documentElement.classList.toggle('reduced-motion', getSettings().reducedMotion);
  }

  // ------------------------------------------------------------ play flow

  async play() {
    if (!this.avatar || !this.base) {
      this.go('photo');
      return;
    }
    sfx.click();
    const settings = getSettings();
    setAvatarTextures(
      renderHead(this.base, this.avatar, 1),
      drawBodySheet(this.avatar.outfit, skinTone(this.base, this.avatar)),
      headPivot(this.base.meta),
    );
    this.go(null);
    // Demo recordings stay in the page (headless fullscreen would use a different screen size).
    if (!new URLSearchParams(location.search).has('demo')) await enterGameMode(this.root);

    if (!this.introShown) {
      this.introShown = true;
      await playDigitizer(this.root, this.base, this.avatar, settings.reducedMotion);
    }

    this.running = true;
    const tutorial = !settings.tutorialDone && !this.startAt();
    this.hud.show({ padToggle: tutorial });
    this.detachTouch();
    if (isTouch()) this.detachTouch = attachTouchControls($('#game'), $('#pad'));
    this.portraitTip();
    startRun({
      seed: (Math.random() * 2 ** 32) >>> 0,
      slowMode: settings.slowMode,
      reducedMotion: settings.reducedMotion,
      vibration: settings.vibration,
      tutorial,
      debug: this.debug,
      startAt: this.startAt(),
      autopilotMs: this.autopilotMs(),
    });
  }

  private detachTouch: () => void = () => {};

  /**
   * Dev only: `?debug&start=380` starts near the end of zone 1 (robot testing).
   * `?demo&start=…&autopilot=14` is the same without hitboxes, and the game plays
   * itself for 14 s (used to record promo videos).
   */
  private startAt(): number | undefined {
    const q = new URLSearchParams(location.search);
    const n = Number(q.get('start'));
    return (this.debug || q.has('demo')) && n > 0 ? n : undefined;
  }

  private autopilotMs(): number | undefined {
    const q = new URLSearchParams(location.search);
    const s = Number(q.get('autopilot'));
    return q.has('demo') && s > 0 ? s * 1000 : undefined;
  }

  /** Upright phone: one friendly tip (once) – playing upright is fine. */
  private portraitTip() {
    if (!isTouch() || !isPortrait() || getSettings().portraitTipShown) return;
    if (new URLSearchParams(location.search).has('demo')) return;
    setSettings({ portraitTipShown: true });
    setTimeout(
      () => toast('Tip: turn your phone sideways for a bigger view.', undefined, 4000),
      1500,
    );
  }

  pause() {
    if (!this.running || this.current === 'pause') return;
    pauseRun();
    pauseMusic();
    this.go('pause');
  }

  resume() {
    this.go(null);
    resumeRun();
    resumeMusic();
  }

  quitToMenu() {
    this.detachTouch();
    stopRun();
    stopMusic();
    this.running = false;
    this.hud.hide();
    this.go('menu');
  }

  private wireGameEvents() {
    if (this.wired) return;
    this.wired = true;

    onGame(EVENTS.hud, (d: Parameters<Hud['update']>[0]) => this.hud.update(d));
    onGame(EVENTS.zone, (d: { index: number; name: string }) => this.hud.banner(d.name, d.index));
    onGame(EVENTS.chase, (k: ChaseKind) => this.hud.chase(k));
    onGame(EVENTS.announce, (text: string) => this.hud.announce(text));
    onGame(EVENTS.hint, (h: Parameters<Hud['hint']>[0]) => {
      this.hud.hint(h);
      if (h === 'done') setSettings({ tutorialDone: true });
    });
    onGame(EVENTS.pause, () => this.pause());
    onGame(EVENTS.over, (d: GameOverData) => {
      this.running = false;
      this.detachTouch();
      this.hud.hide();
      this.go('gameover', d);
    });

    this.hud.onPause = () => this.pause();

    // Pause when the player leaves the tab or the window.
    document.addEventListener('visibilitychange', () => document.hidden && this.pause());
    window.addEventListener('blur', () => this.pause());

    // Android back button / browser back: leave the game, back to the page.
    window.addEventListener('popstate', () => {
      if (!this.root.classList.contains('hidden')) this.close();
    });
  }
}
