import Phaser from 'phaser';
import { playGameOverJingle, playZoneMusic, stopMusic } from '../../audio/music';
import { sfx } from '../../audio/sfx';
import { GROUND_TILE, GROUND_Y, LAYER_SIZE, ZONES, type ZoneArt } from '../../art/world';
import { PX_PER_METRE } from '../../config';
import type { GameInput } from '../../ui/gestures';
import { DebugOverlay } from '../debugOverlay';
import { dissolve, popText, puff } from '../effects';
import { EVENTS, type HintKind, type RunConfig } from '../events';
import { Player } from '../Player';
import { computeView, playerX, type View } from '../view';
import { ROBOT_WALK, type RobotFrame } from '../../art/robot';
import {
  BOMB_FLIGHT_MS,
  bombArc,
  crashOutcome,
  DANGER_MS,
  LASER_FIRE_MS,
  LASER_WARN_MS,
  pickAttack,
  RUSH_ATTACK_EVERY_MS,
  type RobotAttack,
  FIRST_POWER_M,
  isBossChase,
  makeRng,
  metres,
  nextGapPx,
  pickPattern,
  POWER_PITY_M,
  POWER_SECONDS,
  POWERS,
  speedAt,
  TUTORIAL,
  zoneIndexAt,
  type Lesson,
  type LessonAction,
  type Pattern,
  type PowerId,
} from '../rules';

type ArcadeSprite = Phaser.Physics.Arcade.Sprite;

interface Layers {
  sky: Phaser.GameObjects.Image;
  /** Dirt below the ground band (only visible on tall/portrait screens). */
  dirt: Phaser.GameObjects.Rectangle;
  far: Phaser.GameObjects.TileSprite;
  mid: Phaser.GameObjects.TileSprite;
  ground: Phaser.GameObjects.TileSprite;
}

const HIGH_BOTTOM = GROUND_Y - 60;
/** Tutorial: how slow time gets while waiting for the player to act. */
const SLOW_MO = 0.25;
const POWER_NAMES: Record<PowerId, string> = {
  shield: 'SHIELD!',
  magnet: 'MAGNET!',
  jetpack: 'JETPACK!',
};

/** The endless "Zone Run". One instance, restarted for every run. */
export class RunScene extends Phaser.Scene {
  private cfg!: RunConfig;
  private rng!: () => number;
  private player!: Player;
  private layers!: Layers;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private gears!: Phaser.Physics.Arcade.Group;
  private powers!: Phaser.Physics.Arcade.Group;
  private robot!: Phaser.GameObjects.Image;
  private shield!: Phaser.GameObjects.Image;
  private flame!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private debug?: DebugOverlay;
  private view!: View;

  private distancePx = 0;
  private speed = 0;
  private gearCount = 0;
  private nextSpawnAt = 0;
  private zoneIdx = 0;
  private chasing = false;
  private power: PowerId | null = null;
  private powerUntil = 0;
  private lastPowerM = 0;
  private invulnUntil = 0;
  private over = false;
  private started = false;
  private lastHudAt = 0;
  private stompAt = 0;
  // Robot
  private dangerUntil = 0;
  private stumbleUntil = 0;
  private nextAttackAt = 0;
  private lastAttack: RobotAttack | null = null;
  private robotPoseUntil = 0;
  private robotPose: RobotFrame = 'walk0';
  private laser: {
    warn: Phaser.GameObjects.Graphics;
    beam?: Phaser.GameObjects.Rectangle;
    fireAt: number;
    endAt: number;
  } | null = null;
  private marks: {
    mark: Phaser.GameObjects.Image;
    bomb: Phaser.GameObjects.Image;
    from: { x: number; y: number };
    thrownAt: number;
  }[] = [];
  private autopilotUntil = 0;
  private dustAt = 0;
  private lineAt = 0;

  // Tutorial
  private lessons: Lesson[] = [];
  private lessonIndex = 0;
  private activeLesson: number | null = null;
  private lessonsDone = new Set<number>();
  private slow = 1;
  private lastHint: HintKind | null = null;
  private tutorialFinished = false;

  constructor() {
    super('run');
  }

  create(cfg: RunConfig) {
    this.cfg = cfg;
    this.rng = makeRng(cfg.seed);
    this.distancePx = (cfg.startAt ?? 0) * PX_PER_METRE;
    this.speed = 0;
    this.gearCount = 0;
    this.nextSpawnAt = this.distancePx + 520;
    this.zoneIdx = 0;
    this.chasing = false;
    this.power = null;
    this.lastPowerM = FIRST_POWER_M - POWER_PITY_M;
    this.invulnUntil = 0;
    this.dangerUntil = 0;
    this.stumbleUntil = 0;
    this.nextAttackAt = 0;
    this.lastAttack = null;
    this.robotPoseUntil = 0;
    this.laser = null;
    this.marks = [];
    this.autopilotUntil = 0;
    this.over = false;
    this.started = false;
    this.lessons = cfg.tutorial ? [...TUTORIAL] : [];
    this.lessonIndex = 0;
    this.activeLesson = null;
    this.lessonsDone = new Set();
    this.slow = 1;
    this.lastHint = null;
    this.tutorialFinished = !cfg.tutorial;
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;

    this.view = computeView(this.scale.width, this.scale.height);
    this.layers = this.makeLayers(ZONES[0]);
    this.clouds = Array.from({ length: 6 }, (_, i) =>
      this.add
        .image(i * 120 + Math.random() * 60, this.cloudY(), 'cloud')
        .setDepth(0.5)
        .setAlpha(0.9)
        .setScale(0.8 + Math.random() * 0.6),
    );

    const groundBody = this.add.rectangle(0, GROUND_Y + 30, 6000, 60).setVisible(false);
    this.physics.add.existing(groundBody, true);

    const px = playerX(this.view);
    this.shadow = this.add.image(px, GROUND_Y + 1, 'shadow').setDepth(4);
    this.player = new Player(this, px, {
      jump: (double) => this.onPlayerJump(double),
      land: (impact) => this.onPlayerLand(impact),
    });
    this.physics.add.collider(this.player.box, groundBody);

    const groupCfg = { allowGravity: false, immovable: true };
    this.obstacles = this.physics.add.group(groupCfg);
    this.gears = this.physics.add.group(groupCfg);
    this.powers = this.physics.add.group(groupCfg);

    this.physics.add.overlap(this.player.box, this.obstacles, (_p, o) =>
      this.hitObstacle(o as ArcadeSprite),
    );
    this.physics.add.overlap(this.player.box, this.gears, (_p, g) =>
      this.collectGear(g as ArcadeSprite),
    );
    this.physics.add.overlap(this.player.box, this.powers, (_p, s) =>
      this.collectPower(s as ArcadeSprite),
    );

    this.robot = this.add
      .image(-200, GROUND_Y + 2, 'robot', 'walk0')
      .setOrigin(0.5, 1)
      .setDepth(8);
    this.shield = this.add.image(0, 0, 'bubble').setDepth(12).setVisible(false);
    this.flame = this.add.image(0, 0, 'flame').setDepth(9).setVisible(false);

    this.setupInput();
    this.debug = cfg.debug ? new DebugOverlay(this) : undefined;

    this.applyView();
    const onResize = () => this.applyView();
    this.scale.on('resize', onResize);
    const onInput = (i: GameInput) => this.touchInput(i);
    this.game.events.on(EVENTS.input, onInput);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
      this.scale.off('resize', onResize);
      this.game.events.off(EVENTS.input, onInput);
      stopMusic();
    });
    this.emitHud(true);
    this.countdown();
  }

  /** "Ready… GO!" – the player stands still, then the world starts moving. */
  private countdown() {
    this.player.frozen = true;
    this.emit(EVENTS.announce, 'Ready…');
    sfx.ready();
    this.time.delayedCall(800, () => {
      this.emit(EVENTS.announce, 'GO!');
      sfx.go();
      this.player.frozen = false;
      this.started = true;
      if (this.cfg.autopilotMs) this.autopilotUntil = this.time.now + this.cfg.autopilotMs;
      playZoneMusic(0);
      this.emit(EVENTS.zone, { index: 0, name: ZONES[0].name });
    });
  }

  // ---------------------------------------------------------------- input

  private setupInput() {
    const kb = this.input.keyboard!;
    const jumpDown = (e: KeyboardEvent) => !e.repeat && this.doJump();
    const jumpUp = () => this.player.releaseJump();
    const slideDown = (e: KeyboardEvent) => !e.repeat && this.doSlide();
    const slideUp = () => this.player.releaseSlide();
    for (const k of ['SPACE', 'UP', 'W']) {
      kb.on(`keydown-${k}`, jumpDown);
      kb.on(`keyup-${k}`, jumpUp);
    }
    for (const k of ['DOWN', 'S']) {
      kb.on(`keydown-${k}`, slideDown);
      kb.on(`keyup-${k}`, slideUp);
    }
    for (const k of ['ESC', 'P']) kb.on(`keydown-${k}`, () => this.emit(EVENTS.pause));
    kb.addCapture(['SPACE', 'UP', 'DOWN']);

    // Mouse: click jumps (hold for a higher jump). Touch is handled by the
    // HTML layer (gestures + optional buttons, src/ui/touchControls.ts).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.doJump();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.player.releaseJump();
    });
  }

  /** Input from touch gestures or on-screen buttons. */
  private touchInput(i: GameInput) {
    switch (i) {
      case 'jumpTap':
        this.doJump();
        this.player.softReleaseJump();
        break;
      case 'jumpDown':
        this.doJump();
        break;
      case 'jumpUp':
        this.player.releaseJump();
        break;
      case 'slideDown':
        this.doSlide();
        break;
      case 'slideUp':
        this.player.releaseSlide();
        break;
    }
  }

  /**
   * Demo/video only (`?demo&autopilot=…`): a simple bot that jumps over low
   * things, slides under high things and the laser. Never on for players.
   */
  private autopilot(time: number) {
    const px = this.player.box.x;
    let slide = !!this.laser && time > this.laser.fireAt - 300;
    for (const o of this.obstacles.getChildren() as ArcadeSprite[]) {
      if (!o.active) continue;
      const left = o.x - o.displayWidth / 2 - px;
      const right = o.x + o.displayWidth / 2 - px;
      const high = o.y + o.displayHeight / 2 < GROUND_Y - 30;
      // Slide from shortly before a high obstacle until it is fully behind you.
      if (high && left < 115 && right > -30) slide = true;
      if (left < -10 || left > 130) continue;
      if (!high && left < 95 && !o.getData('ap')) {
        o.setData('ap', true);
        this.player.pressJump(time);
        this.player.softReleaseJump();
      }
    }
    // A bomb mark is a low obstacle that is still on its way: jump at the same distance.
    for (const m of this.marks) {
      const left = m.mark.x - m.mark.displayWidth / 2 - px;
      if (left > -10 && left < 95 && !m.mark.getData('ap')) {
        m.mark.setData('ap', true);
        this.player.pressJump(time);
        this.player.softReleaseJump();
      }
    }
    if (slide && !this.player.isSliding) this.doSlide();
    if (!slide && this.player.isSliding) this.player.releaseSlide();
  }

  // ---------------------------------------------------------------- view

  /** Fit the camera to the screen (called on start and on every resize/rotation). */
  private applyView() {
    const v = computeView(this.scale.width, this.scale.height);
    this.view = v;
    const cam = this.cameras.main;
    cam.setZoom(v.zoom);
    cam.centerOn(v.left + v.width / 2, v.top + v.height / 2);
    this.layoutLayers(this.layers);
  }

  private get spawnX() {
    return this.view.left + this.view.width + 60;
  }

  private cloudY() {
    const top = Math.max((this.view?.top ?? 0) + 20, GROUND_Y - 470);
    return top + Math.random() * (GROUND_Y - 170 - top);
  }
  private padState = { a: false, b: false, start: false };

  private pollGamepad() {
    const pad = this.input.gamepad?.pad1;
    if (!pad) return;
    const a = pad.A || pad.up;
    const b = pad.B || pad.down;
    const start = pad.buttons[9]?.pressed ?? false;
    if (a && !this.padState.a) this.doJump();
    if (!a && this.padState.a) this.player.releaseJump();
    if (b && !this.padState.b) this.doSlide();
    if (!b && this.padState.b) this.player.releaseSlide();
    if (start && !this.padState.start) this.emit(EVENTS.pause);
    this.padState = { a, b, start };
  }

  private doJump() {
    if (this.over) return;
    this.player.pressJump(this.time.now);
  }

  private doSlide() {
    if (this.over) return;
    if (this.player.slide(this.time.now)) {
      sfx.slide();
      this.lessonAction('slide');
    }
  }

  private onPlayerJump(double: boolean) {
    if (double) {
      sfx.doubleJump();
      if (!this.cfg.reducedMotion)
        puff(this, this.player.feet.x, this.player.feet.y, 4, 14, 0xfff3b0);
      this.lessonAction('double');
    } else {
      sfx.jump();
      if (!this.cfg.reducedMotion) puff(this, this.player.feet.x, this.player.feet.y, 3, 10);
    }
    this.lessonAction('jump');
  }

  private onPlayerLand(impact: number) {
    if (impact > 300) sfx.land();
    if (!this.cfg.reducedMotion)
      puff(this, this.player.feet.x, this.player.feet.y, impact > 600 ? 6 : 3, 18);
  }

  // ---------------------------------------------------------------- loop

  update(time: number, deltaMs: number) {
    const dt = (Math.min(deltaMs, 50) / 1000) * this.slow;
    const m = metres(this.distancePx, PX_PER_METRE);
    if (!this.started) this.speed = 0;
    else if (this.over) this.speed = Math.max(0, this.speed - 900 * dt);
    // Portrait shows less road ahead, so it runs a little slower.
    else {
      // A stumble slows you down for a moment (the robot catches up).
      const trip =
        time < this.stumbleUntil ? 0.6 + 0.4 * (1 - (this.stumbleUntil - time) / 900) : 1;
      this.speed = speedAt(m, this.cfg.slowMode) * (this.view.portrait ? 0.9 : 1) * trip;
    }
    this.distancePx += this.speed * dt;

    this.layers.far.tilePositionX += this.speed * dt * 0.12;
    this.layers.mid.tilePositionX += this.speed * dt * 0.4;
    this.layers.ground.tilePositionX += this.speed * dt;
    for (const c of this.clouds) {
      c.x -= (this.speed * 0.05 + 6) * dt;
      if (c.x < this.view.left - 40) {
        c.x = this.view.left + this.view.width + 40;
        c.y = this.cloudY();
      }
    }

    for (const g of [this.obstacles, this.gears, this.powers]) {
      for (const child of g.getChildren() as ArcadeSprite[]) {
        if (!child.active) continue;
        child.setVelocityX(-this.speed);
        if (child.x < this.view.left - 120) child.disableBody(true, true);
      }
    }

    if (this.started && !this.over) {
      if (this.distancePx >= this.nextSpawnAt) this.spawnNext(m);
      const zi = zoneIndexAt(m);
      if (zi !== this.zoneIdx) this.changeZone(zi);
      this.updateChase(isBossChase(m), time);
      this.updatePower(time);
      this.updateTutorial();
      this.updateEffects(time);
      if (time < this.autopilotUntil) this.autopilot(time);
      else if (this.autopilotUntil) {
        // Autopilot over: let go of the controls (a held slide would never end).
        this.autopilotUntil = 0;
        if (this.player.isSliding) this.player.releaseSlide();
      }
    }
    this.pollGamepad();

    this.player.update(time, this.distancePx);
    this.updateAttachments(time);

    if (time - this.lastHudAt > 100) this.emitHud();
    this.debug?.update({
      speed: this.speed,
      metres: m,
      zone: ZONES[this.zoneIdx % ZONES.length].id,
      seed: this.cfg.seed,
      objects: this.obstacles.countActive() + this.gears.countActive() + this.powers.countActive(),
      power: this.power,
      slow: this.slow,
    });
  }

  /** Shadow, shield bubble, jetpack flame, blinking. */
  private updateAttachments(time: number) {
    const feet = this.player.feet;
    const height = Math.max(0, GROUND_Y - feet.y);
    const k = Phaser.Math.Clamp(1 - height / 220, 0.35, 1);
    this.shadow
      .setPosition(feet.x + 2, GROUND_Y + 1)
      .setScale(k)
      .setAlpha(this.player.dead ? 0 : k);

    this.shield.setVisible(this.power === 'shield' && !this.player.dead);
    if (this.shield.visible) this.shield.setPosition(feet.x, feet.y - 42);
    this.flame.setVisible(this.power === 'jetpack' && !this.player.dead);
    if (this.flame.visible)
      this.flame.setPosition(feet.x - 14, feet.y - 26 + (time % 120 < 60 ? 0 : 2));

    const blink = !this.player.dead && time < this.invulnUntil && Math.floor(time / 120) % 2 === 0;
    this.player.head.setAlpha(blink ? 0.65 : 1);
    this.player.bodySprite.setAlpha(blink ? 0.65 : 1);
  }

  /** Running dust, slide sparks and speed lines. */
  private updateEffects(time: number) {
    if (this.cfg.reducedMotion) return;
    const feet = this.player.feet;
    if (this.player.onGround && !this.player.flying && time > this.dustAt) {
      if (this.player.isSliding) {
        puff(this, feet.x + 14, feet.y, 1, 4, 0xffe39a);
        this.dustAt = time + 50;
      } else {
        puff(this, feet.x - 6, feet.y, 1, 4);
        this.dustAt = time + Math.max(90, 220 - this.speed / 3);
      }
    }
    if (this.speed > 380 && time > this.lineAt) {
      this.lineAt = time + 70;
      const line = this.add
        .image(
          this.view.left + this.view.width + 20,
          Math.max(this.view.top + 20, GROUND_Y - 280) + Math.random() * 260,
          'speedline',
        )
        .setDepth(25)
        .setAlpha(0.35 + ((this.speed - 380) / 140) * 0.3);
      this.tweens.add({
        targets: line,
        x: this.view.left - 40,
        duration: 260,
        onComplete: () => line.destroy(),
      });
    }
  }

  // ---------------------------------------------------------------- spawning

  private zone(): ZoneArt {
    return ZONES[this.zoneIdx % ZONES.length];
  }

  private spawnNext(m: number) {
    let gapScale = 1;
    if (this.lessonIndex < this.lessons.length) {
      this.spawnLesson(this.lessonIndex);
      this.lessonIndex++;
      gapScale = 2;
    } else if (this.power === 'jetpack' || this.chasing) {
      this.spawnPattern('gearsLine');
    } else {
      const p = pickPattern(this.rng, m, this.power !== null, this.lastPowerM);
      if (p === 'power') this.lastPowerM = m;
      this.spawnPattern(p);
    }
    const gap = nextGapPx(this.rng, m, this.chasing, this.cfg.slowMode);
    this.nextSpawnAt = this.distancePx + gap * gapScale;
  }

  private spawnLesson(index: number) {
    const lesson = this.lessons[index];
    const z = this.zone();
    let marker: ArcadeSprite;
    switch (lesson.pattern) {
      case 'high':
        marker = this.addObstacle(z.high.key, this.spawnX, true, 'slide');
        break;
      case 'doubleGears':
        // Only reachable with a double jump.
        marker = this.addGear(this.spawnX, GROUND_Y - 175);
        for (let i = 1; i < 5; i++) this.addGear(this.spawnX + i * 24, GROUND_Y - 175);
        break;
      case 'tutorialPower':
        marker = this.addPower('shield', this.spawnX);
        this.lastPowerM = metres(this.distancePx, PX_PER_METRE);
        break;
      default:
        marker = this.addObstacle(z.low.key, this.spawnX, false, 'jump');
    }
    marker.setData('lesson', index);
  }

  private spawnPattern(p: Pattern) {
    const z = this.zone();
    const x = this.spawnX;
    switch (p) {
      case 'low':
        this.addObstacle(z.low.key, x, false, null);
        break;
      case 'crate':
        this.addObstacle('crate', x, false, null);
        break;
      case 'high':
        this.addObstacle(z.high.key, x, true, null);
        break;
      case 'lowLow':
        this.addObstacle(z.low.key, x, false, null);
        this.addObstacle('crate', x + 70, false, null);
        break;
      case 'lowGears': {
        this.addObstacle(z.low.key, x, false, null);
        for (let i = 0; i < 5; i++) {
          const t = (i - 2) / 2;
          this.addGear(x + (i - 2) * 30, GROUND_Y - 70 - 60 * (1 - t * t));
        }
        break;
      }
      case 'highGears':
        this.addObstacle(z.high.key, x, true, null);
        for (let i = 0; i < 4; i++) this.addGear(x - 20 + i * 24, GROUND_Y - 18);
        break;
      case 'gearsLine': {
        const y =
          this.power === 'jetpack' ? 140 : this.rng() < 0.5 ? GROUND_Y - 20 : GROUND_Y - 120;
        for (let i = 0; i < 6; i++) this.addGear(x + i * 26, y);
        break;
      }
      case 'power':
        this.addPower(POWERS[Math.floor(this.rng() * POWERS.length)], x);
        break;
    }
  }

  private revive(s: ArcadeSprite, x: number, y: number, key: string) {
    s.setTexture(key);
    s.enableBody(true, x, y, true, true);
    s.setAngle(0).setAlpha(1).setScale(1);
    s.setData('lesson', null);
    s.setData('ap', false); // pooled sprites: forget the old autopilot jump
    this.tweens.killTweensOf(s);
  }

  private addObstacle(key: string, x: number, high: boolean, hint: HintKind | null): ArcadeSprite {
    const tex = this.textures.get(key).getSourceImage();
    const h = tex.height;
    const y = high ? HIGH_BOTTOM - h / 2 : GROUND_Y - h / 2;
    const s = this.obstacles.get(x, y, key) as ArcadeSprite;
    this.revive(s, x, y, key);
    s.setDepth(5);
    const body = s.body as Phaser.Physics.Arcade.Body;
    // Forgiving hitbox: 80% wide, a bit shorter.
    body.setSize(tex.width * 0.8, h * (high ? 0.7 : 0.85), true);
    s.setData('hint', hint);
    this.animateObstacle(s, key);
    return s;
  }

  /** A little life: flying things bob, garden gnomes wobble. */
  private animateObstacle(s: ArcadeSprite, key: string) {
    if (this.cfg.reducedMotion) return;
    if (key === 'seagull' || key === 'ufo' || key === 'clothesline' || key === 'coasterbar') {
      this.tweens.add({
        targets: s,
        y: s.y - 4,
        duration: key === 'seagull' ? 220 : 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    } else if (key === 'gnome' || key === 'cone') {
      this.tweens.add({
        targets: s,
        angle: { from: -4, to: 4 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private addGear(x: number, y: number): ArcadeSprite {
    const g = this.gears.get(x, y, 'gear') as ArcadeSprite;
    this.revive(g, x, y, 'gear');
    g.setDepth(6);
    this.tweens.add({ targets: g, angle: 360, duration: 900, repeat: -1 });
    return g;
  }

  private addPower(id: PowerId, x: number): ArcadeSprite {
    const y = GROUND_Y - 80;
    const s = this.powers.get(x, y, id) as ArcadeSprite;
    this.revive(s, x, y, id);
    s.setData('power', id).setDepth(6);
    this.tweens.add({ targets: s, y: '-=8', duration: 400, yoyo: true, repeat: -1 });
    if (!this.cfg.reducedMotion) {
      this.tweens.add({
        targets: s,
        scale: { from: 1, to: 1.15 },
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
    }
    return s;
  }

  // ---------------------------------------------------------------- collisions

  private hitObstacle(o: ArcadeSprite) {
    if (this.over || !o.active || this.player.flying || this.time.now < this.invulnUntil) return;

    // During the tutorial, a mistake is a lesson, not a game over.
    if (o.getData('hint')) {
      o.disableBody(true, true);
      this.invulnUntil = this.time.now + 800;
      this.endLesson(false);
      this.emit(EVENTS.hint, 'again');
      return;
    }

    o.disableBody(true, true);
    if (o.texture.key === 'bomb') this.explode(o.x, o.y);
    this.crash(o.x, o.y);
  }

  /** Something hit the player (obstacle, bomb or laser). */
  private crash(x: number, y: number) {
    if (this.over || this.time.now < this.invulnUntil) return;
    if (this.power === 'shield') {
      this.power = null;
      this.invulnUntil = this.time.now + 700;
      sfx.shieldBreak();
      this.burst(x, y, 0x78dcff);
      return;
    }
    const outcome = crashOutcome(this.time.now, this.dangerUntil);
    if (outcome === 'stumble') {
      this.stumble();
      return;
    }
    if (outcome === 'caught') {
      // The robot grabs you.
      this.tweens.killTweensOf(this.robot);
      this.robot.x = this.player.box.x - 40;
      this.robot.setFrame('throw');
    }
    this.gameOver();
  }

  private stumble() {
    const now = this.time.now;
    sfx.stumble();
    if (this.cfg.vibration) navigator.vibrate?.(80);
    if (!this.cfg.reducedMotion) this.cameras.main.shake(140, 0.006);
    this.player.stumble(now);
    this.stumbleUntil = now + 900;
    this.invulnUntil = now + 1200;
    this.dangerUntil = now + DANGER_MS;
    this.emit(EVENTS.chase, 'close');
    this.time.delayedCall(DANGER_MS, () => {
      if (!this.over && this.time.now >= this.dangerUntil)
        this.emit(EVENTS.chase, this.chasing ? 'rush' : null);
    });
  }

  private gameOver() {
    this.over = true;
    this.slow = 1;
    this.physics.world.timeScale = 1;
    sfx.hit();
    playGameOverJingle();
    if (this.cfg.vibration) navigator.vibrate?.(200);
    this.player.hurt();
    // Hit-stop: freeze for a moment so the crash "lands", then break into pixels.
    this.physics.world.pause();
    if (!this.cfg.reducedMotion) this.cameras.main.shake(200, 0.01);
    this.time.delayedCall(180, () => {
      sfx.dissolve();
      this.clearAttacks();
      dissolve(this, [this.player.bodySprite, this.player.head], this.cfg.reducedMotion, () => {
        this.emit(EVENTS.over, {
          metres: metres(this.distancePx, PX_PER_METRE),
          gears: this.gearCount,
        });
      });
    });
  }

  private collectGear(g: ArcadeSprite) {
    if (!g.active || this.player.dead) return;
    g.disableBody(true, true);
    this.gearCount++;
    sfx.gear();
    this.burst(g.x, g.y, this.zone().accent, 4);
    if (!this.cfg.reducedMotion) popText(this, g.x, g.y - 6, '+1');
  }

  private collectPower(s: ArcadeSprite) {
    if (!s.active || this.player.dead) return;
    const id = s.getData('power') as PowerId;
    s.disableBody(true, true);
    sfx.power();
    popText(this, s.x, s.y - 10, POWER_NAMES[id], '#9cf3ff');
    this.power = id;
    this.powerUntil = this.time.now + POWER_SECONDS[id] * 1000;
    if (id === 'jetpack') this.player.setFlying(true);
    this.lessonAction('power');
  }

  private updatePower(time: number) {
    if (!this.power) return;
    if (this.power === 'magnet') {
      const head = this.player.box;
      for (const g of this.gears.getChildren() as ArcadeSprite[]) {
        if (!g.active) continue;
        const dx = head.x - g.x;
        const dy = head.y - 40 - g.y;
        if (dx * dx + dy * dy < 200 * 200) {
          g.x += dx * 0.12;
          g.y += dy * 0.12;
        }
      }
    }
    if (time > this.powerUntil) {
      if (this.power === 'jetpack') {
        this.player.setFlying(false);
        this.invulnUntil = time + 1200;
      }
      this.power = null;
    }
  }

  private burst(x: number, y: number, tint: number, n = 8) {
    if (this.cfg.reducedMotion) return;
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'spark').setTint(tint).setDepth(20);
      const a = (i / n) * Math.PI * 2;
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * 18,
        y: y + Math.sin(a) * 18,
        alpha: 0,
        duration: 300,
        onComplete: () => s.destroy(),
      });
    }
  }

  // ---------------------------------------------------------------- zones + robot

  private makeLayers(z: ZoneArt): Layers {
    const w = this.view.width;
    const layers: Layers = {
      sky: this.add.image(0, 0, `${z.id}-sky`).setOrigin(0).setDepth(0),
      dirt: this.add
        .rectangle(0, GROUND_Y + GROUND_TILE.h, w, 10, pixelColour(this, `${z.id}-ground`, 55))
        .setOrigin(0)
        .setDepth(3),
      far: this.add
        .tileSprite(0, GROUND_Y - LAYER_SIZE.h - 20, w, LAYER_SIZE.h, `${z.id}-far`)
        .setOrigin(0)
        .setDepth(1),
      mid: this.add
        .tileSprite(0, GROUND_Y - LAYER_SIZE.h + 10, w, LAYER_SIZE.h, `${z.id}-mid`)
        .setOrigin(0)
        .setDepth(2),
      ground: this.add
        .tileSprite(0, GROUND_Y, w, GROUND_TILE.h, `${z.id}-ground`)
        .setOrigin(0)
        .setDepth(3),
    };
    // Above the sky picture: the sky's top colour (tall screens see more sky).
    this.cameras.main.setBackgroundColor(pixelColour(this, `${z.id}-sky`, 1));
    this.layoutLayers(layers);
    return layers;
  }

  /** Stretch/move the background layers to cover the current view. */
  private layoutLayers(l: Layers | undefined) {
    if (!l) return;
    const v = this.view;
    l.sky.setPosition(v.left, 0).setDisplaySize(v.width, 360);
    for (const t of [l.far, l.mid, l.ground]) t.setX(v.left).setSize(v.width, t.height);
    const below = v.top + v.height - (GROUND_Y + GROUND_TILE.h);
    l.dirt.setPosition(v.left, GROUND_Y + GROUND_TILE.h).setSize(v.width, Math.max(1, below + 2));
    l.dirt.setVisible(below > 0);
  }

  private changeZone(index: number) {
    this.zoneIdx = index;
    const z = this.zone();
    const old = this.layers;
    const next = this.makeLayers(z);
    // Keep the scroll position so the swap is seamless.
    next.far.tilePositionX = old.far.tilePositionX;
    next.mid.tilePositionX = old.mid.tilePositionX;
    next.ground.tilePositionX = old.ground.tilePositionX;
    const all = Object.values(next);
    all.forEach((o) => o.setAlpha(0));
    this.tweens.add({
      targets: all,
      alpha: 1,
      duration: 500,
      onComplete: () => Object.values(old).forEach((o) => o.destroy()),
    });
    this.layers = next;
    // No clouds in space.
    this.tweens.add({ targets: this.clouds, alpha: z.id === 'space' ? 0 : 0.9, duration: 500 });
    this.zapRobot();
    sfx.zap();
    playZoneMusic(index);
    if (!this.cfg.reducedMotion) this.cameras.main.flash(250, 255, 255, 255);
    const lap = Math.floor(index / ZONES.length);
    this.emit(EVENTS.zone, { index, name: lap ? `${z.name} (lap ${lap + 1})` : z.name });
  }

  /** Robot Rush at the end of each zone, plus the robot following you after a stumble. */
  private updateChase(chase: boolean, time: number) {
    if (chase !== this.chasing) {
      this.chasing = chase;
      this.nextAttackAt = time + 1200;
      this.emit(EVENTS.chase, chase ? 'rush' : time < this.dangerUntil ? 'close' : null);
    }
    const danger = time < this.dangerUntil;
    const v = this.view;
    // Where the robot wants to be: right behind you (danger), at the left edge (rush), or gone.
    const target = danger ? this.player.box.x - 78 : chase ? v.left + 60 : v.left - 200;
    this.robot.x += (target - this.robot.x) * 0.06;
    this.robot.setVisible(this.robot.x > v.left - 120);

    if (this.robot.visible) {
      const pose =
        time < this.robotPoseUntil
          ? this.robotPose
          : ROBOT_WALK[Math.floor(time / 110) % ROBOT_WALK.length];
      this.robot.setFrame(pose);
      if (time > this.stompAt) {
        this.stompAt = time + 440;
        sfx.robot();
        if (!this.cfg.reducedMotion) {
          this.cameras.main.shake(70, 0.0025);
          puff(this, this.robot.x - 10, GROUND_Y, 3, 30);
        }
      }
    }
    if (chase && time > this.nextAttackAt && !this.laser) {
      this.nextAttackAt = time + RUSH_ATTACK_EVERY_MS * (this.cfg.slowMode ? 1.25 : 1);
      const a = pickAttack(this.rng, this.lastAttack);
      this.lastAttack = a;
      if (a === 'laser') this.startLaser(time);
      else this.throwBomb(time);
    }
    this.updateAttacks(time);
  }

  /** Laser: a blinking warning line at chest height, then the beam. Slide under it! */
  private startLaser(time: number) {
    this.robotPose = 'laser';
    this.robotPoseUntil = time + LASER_WARN_MS + LASER_FIRE_MS;
    const y = GROUND_Y - 56;
    const warn = this.add.graphics().setDepth(24);
    const v = this.view;
    warn.fillStyle(0xff5a5a, 0.18);
    warn.fillRect(v.left, y - 7, v.width, 14);
    warn.lineStyle(3, 0xff5a5a, 1);
    for (let x = v.left; x < v.left + v.width; x += 16) warn.lineBetween(x, y, x + 10, y);
    warn.fillStyle(0xff5a5a, 1);
    warn.fillRect(v.left + v.width - 26, y - 22, 6, 12);
    warn.fillRect(v.left + v.width - 26, y - 7, 6, 4);
    this.tweens.add({ targets: warn, alpha: 0.25, duration: 120, yoyo: true, repeat: -1 });
    sfx.warn();
    this.emit(EVENTS.hint, 'laser');
    this.laser = {
      warn,
      fireAt: time + LASER_WARN_MS,
      endAt: time + LASER_WARN_MS + LASER_FIRE_MS,
    };
  }

  /** Bomb: a red ring marks where it lands, then it sits on the ground. Jump over it! */
  private throwBomb(time: number) {
    this.robotPose = 'throw';
    this.robotPoseUntil = time + 350;
    sfx.throwBomb();
    const mark = this.add.image(this.player.box.x + 330, GROUND_Y + 1, 'mark').setDepth(4);
    this.tweens.add({
      targets: mark,
      scale: { from: 1.3, to: 0.9 },
      duration: 220,
      yoyo: true,
      repeat: -1,
    });
    // The bomb flies in an arc from the robot's hand to the mark. Its position is
    // set every frame from the mark's live x (the mark scrolls with the world).
    const from = { x: this.robot.x + 20, y: GROUND_Y - 80 };
    const bomb = this.add.image(from.x, from.y, 'bomb').setDepth(23);
    this.tweens.add({ targets: bomb, angle: 540, duration: BOMB_FLIGHT_MS });
    this.marks.push({ mark, bomb, from, thrownAt: time });
    this.emit(EVENTS.hint, 'bomb');
  }

  private updateAttacks(time: number) {
    const dt = this.game.loop.delta / 1000;
    // marks scroll with the world, then turn into a bomb on the ground
    const bombH = this.textures.get('bomb').getSourceImage().height;
    this.marks = this.marks.filter(({ mark, bomb, from, thrownAt }) => {
      mark.x -= this.speed * dt * this.slow;
      // Lands exactly where the ground bomb will sit (on the mark).
      const p = (time - thrownAt) / BOMB_FLIGHT_MS;
      const at = bombArc(p, from, { x: mark.x, y: GROUND_Y - bombH / 2 }, 110);
      bomb.setPosition(at.x, at.y);
      if (p < 1) return true;
      bomb.destroy();
      const b = this.addObstacle('bomb', mark.x, false, null);
      b.setData('ap', mark.getData('ap'));
      this.tweens.add({
        targets: b,
        scale: { from: 1.15, to: 1 },
        duration: 160,
        yoyo: true,
        repeat: -1,
      });
      sfx.land();
      mark.destroy();
      return false;
    });
    // bombs you jumped over go off behind you
    for (const o of this.obstacles.getChildren() as ArcadeSprite[]) {
      if (o.active && o.texture.key === 'bomb' && o.x < this.player.box.x - 50) {
        o.disableBody(true, true);
        this.explode(o.x, o.y);
      }
    }
    const l = this.laser;
    if (!l) return;
    if (time >= l.fireAt && !l.beam) {
      l.warn.destroy();
      const v = this.view;
      l.beam = this.add
        .rectangle(v.left, GROUND_Y - 56, v.width, 12, 0xff5a5a)
        .setOrigin(0, 0.5)
        .setDepth(24);
      this.add
        .rectangle(v.left, GROUND_Y - 56, v.width, 4, 0xffd0d0)
        .setOrigin(0, 0.5)
        .setDepth(25)
        .setName('beamCore');
      sfx.laser();
      if (!this.cfg.reducedMotion) this.cameras.main.shake(LASER_FIRE_MS, 0.003);
    }
    if (l.beam) {
      // Hit if the player's hitbox crosses the beam band.
      const b = this.player.body;
      const top = GROUND_Y - 62;
      const bottom = GROUND_Y - 50;
      if (!this.player.flying && b.bottom > top && b.top < bottom)
        this.crash(this.player.box.x, GROUND_Y - 56);
    }
    if (time >= l.endAt) this.clearLaser();
  }

  private clearLaser() {
    if (!this.laser) return;
    this.laser.warn.destroy();
    this.laser.beam?.destroy();
    this.children.getByName('beamCore')?.destroy();
    this.laser = null;
  }

  private clearAttacks() {
    this.clearLaser();
    this.marks.forEach((m) => {
      m.mark.destroy();
      m.bomb.destroy();
    });
    this.marks = [];
  }

  private explode(x: number, y: number) {
    sfx.boom();
    if (!this.cfg.reducedMotion) {
      puff(this, x, y + 8, 8, 30, 0xf08a24);
      puff(this, x, y, 5, 20, 0x5c5c5c);
    }
  }

  /** At the end of a zone the digitizer beam zaps the robot away. */
  private zapRobot() {
    if (!this.robot.visible) return;
    this.clearAttacks();
    this.robot.setFrame('zapped');
    this.robotPose = 'zapped';
    this.robotPoseUntil = this.time.now + 400;
    const beam = this.add
      .rectangle(this.robot.x, GROUND_Y, 40, 400, 0x9cf3ff, 0.8)
      .setOrigin(0.5, 1)
      .setDepth(26);
    this.tweens.add({
      targets: beam,
      scaleX: 0,
      alpha: 0,
      duration: 400,
      onComplete: () => beam.destroy(),
    });
    this.tweens.add({
      targets: this.robot,
      alpha: 0,
      duration: 380,
      onComplete: () => {
        this.robot.x = this.view.left - 220;
        this.robot.setAlpha(1);
      },
    });
  }

  // ---------------------------------------------------------------- tutorial

  /** A lesson starts when its object gets close: time slows until the player acts. */
  private updateTutorial() {
    if (this.tutorialFinished) return;
    if (this.activeLesson !== null) {
      // The lesson object went past (or vanished) without the move: move on.
      const marker = [this.obstacles, this.gears, this.powers]
        .flatMap((g) => g.getChildren() as ArcadeSprite[])
        .find((o) => o.active && o.getData('lesson') === this.activeLesson);
      if (!marker || marker.x < this.player.box.x - 30) {
        this.endLesson(false);
        this.showHint(null);
      }
    }
    if (this.activeLesson === null) {
      for (const g of [this.obstacles, this.gears, this.powers]) {
        for (const o of g.getChildren() as ArcadeSprite[]) {
          const idx = o.active ? (o.getData('lesson') as number | null) : null;
          if (idx === null || idx === undefined || this.lessonsDone.has(idx)) continue;
          const dx = o.x - this.player.box.x;
          if (dx > 0 && dx < 230) this.startLesson(idx);
        }
      }
    }
    // All lessons done and nothing left on screen: the tutorial is over.
    if (
      this.activeLesson === null &&
      this.lessonsDone.size === this.lessons.length &&
      !this.tutorialFinished
    ) {
      this.tutorialFinished = true;
      this.time.delayedCall(900, () => this.showHint('done'));
    }
  }

  private startLesson(index: number) {
    this.activeLesson = index;
    this.setSlow(SLOW_MO);
    this.showHint(this.lessons[index].action);
  }

  private lessonAction(action: LessonAction) {
    if (this.activeLesson === null) return;
    const lesson = this.lessons[this.activeLesson];
    // Jumping also counts for the power-up lesson (you jump to grab it).
    if (lesson.action === action) this.endLesson(true);
  }

  private endLesson(success: boolean) {
    if (this.activeLesson === null) return;
    this.lessonsDone.add(this.activeLesson);
    this.activeLesson = null;
    this.setSlow(1);
    if (success) {
      this.showHint('nice');
      this.time.delayedCall(700, () => this.lastHint === 'nice' && this.showHint(null));
    }
  }

  private setSlow(k: number) {
    this.slow = k;
    this.physics.world.timeScale = 1 / k; // Arcade: higher = slower
    this.tweens.timeScale = k;
  }

  private showHint(h: HintKind | null) {
    this.lastHint = h;
    this.emit(EVENTS.hint, h);
  }

  // ---------------------------------------------------------------- HUD

  private emitHud(force = false) {
    this.lastHudAt = this.time.now;
    const left =
      this.power && this.power !== 'shield'
        ? Math.max(0, (this.powerUntil - this.time.now) / (POWER_SECONDS[this.power] * 1000))
        : 1;
    this.emit(EVENTS.hud, {
      metres: metres(this.distancePx, PX_PER_METRE),
      gears: this.gearCount,
      power: this.power,
      powerLeft: left,
      force,
    });
  }

  private emit(name: string, data?: unknown) {
    this.game.events.emit(name, data);
  }
}

/** Colour of one pixel of a canvas texture (for sky top and dirt fill). */
function pixelColour(scene: Phaser.Scene, key: string, y: number): number {
  const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const d = src.getContext('2d')!.getImageData(1, Math.min(y, src.height - 1), 1, 1).data;
  return (d[0] << 16) | (d[1] << 8) | d[2];
}
