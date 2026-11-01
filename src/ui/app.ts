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
import { EVENTS, type GameOverData } from '../game/events';
import { getSettings, setSettings } from '../storage/local';
import { enterGameMode, isPortrait, isTouch, leaveGameMode } from './device';
import { playDigitizer } from './digitizer';
import { $ } from './dom';
import { Hud } from './hud';
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
    await enterGameMode(this.root);

    if (!this.introShown) {
      this.introShown = true;
      await playDigitizer(this.root, this.base, this.avatar, settings.reducedMotion);
    }

    this.running = true;
    this.hud.show();
    startRun({
      seed: (Math.random() * 2 ** 32) >>> 0,
      slowMode: settings.slowMode,
      reducedMotion: settings.reducedMotion,
      vibration: settings.vibration,
      tutorial: !settings.tutorialDone,
      debug: this.debug,
    });
    this.checkOrientation();
  }

  pause() {
    if (!this.running || this.current === 'pause') return;
    pauseRun();
    pauseMusic();
    this.go('pause');
  }

  resume() {
    this.go(null);
    if (this.checkOrientation()) return;
    resumeRun();
    resumeMusic();
  }

  quitToMenu() {
    stopRun();
    stopMusic();
    this.running = false;
    this.hud.hide();
    this.go('menu');
  }

  /** On phones held upright, cover the game and pause it. Returns true if blocked. */
  checkOrientation(): boolean {
    const blocked = this.running && isTouch() && isPortrait();
    $('#rotate').classList.toggle('hidden', !blocked);
    if (blocked) {
      pauseRun();
      pauseMusic();
    }
    return blocked;
  }

  private wireGameEvents() {
    if (this.wired) return;
    this.wired = true;

    onGame(EVENTS.hud, (d: Parameters<Hud['update']>[0]) => this.hud.update(d));
    onGame(EVENTS.zone, (d: { index: number; name: string }) => this.hud.banner(d.name, d.index));
    onGame(EVENTS.chase, (on: boolean) => this.hud.chase(on));
    onGame(EVENTS.announce, (text: string) => this.hud.announce(text));
    onGame(EVENTS.hint, (h: Parameters<Hud['hint']>[0]) => {
      this.hud.hint(h);
      if (h === 'done') setSettings({ tutorialDone: true });
    });
    onGame(EVENTS.pause, () => this.pause());
    onGame(EVENTS.over, (d: GameOverData) => {
      this.running = false;
      this.hud.hide();
      this.go('gameover', d);
    });

    this.hud.onPause = () => this.pause();

    // Pause when the player leaves the tab or the window.
    document.addEventListener('visibilitychange', () => document.hidden && this.pause());
    window.addEventListener('blur', () => this.pause());

    // Phone rotated: block (portrait) or let the player resume (landscape).
    matchMedia('(orientation: portrait)').addEventListener('change', () => {
      if (!this.running) return;
      if (!this.checkOrientation() && this.current !== 'pause') this.pause();
    });

    // Android back button / browser back: leave the game, back to the page.
    window.addEventListener('popstate', () => {
      if (!this.root.classList.contains('hidden')) this.close();
    });
  }
}
