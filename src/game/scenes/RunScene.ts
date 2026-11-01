import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { GROUND_TILE, GROUND_Y, LAYER_SIZE, ZONES, type ZoneArt } from '../../art/world';
import { PX_PER_METRE, VIEW_W } from '../../config';
import { DebugOverlay } from '../debugOverlay';
import { EVENTS, type HintKind, type RunConfig } from '../events';
import { Player } from '../Player';
import {
  isBossChase,
  makeRng,
  metres,
  nextGapPx,
  pickPattern,
  POWER_SECONDS,
  POWERS,
  speedAt,
  TUTORIAL_PATTERNS,
  zoneIndexAt,
  type Pattern,
  type PowerId,
} from '../rules';

type ArcadeSprite = Phaser.Physics.Arcade.Sprite;

interface Layers {
  sky: Phaser.GameObjects.Image;
  far: Phaser.GameObjects.TileSprite;
  mid: Phaser.GameObjects.TileSprite;
  ground: Phaser.GameObjects.TileSprite;
}

const PLAYER_X = 150;
const SPAWN_X = VIEW_W + 60;
const HIGH_BOTTOM = GROUND_Y - 60;

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
  private debug?: DebugOverlay;

  private distancePx = 0;
  private speed = 0;
  private gearCount = 0;
  private nextSpawnAt = 0;
  private zoneIdx = 0;
  private chasing = false;
  private power: PowerId | null = null;
  private powerUntil = 0;
  private invulnUntil = 0;
  private over = false;
  private tutorialQueue: Pattern[] = [];
  private lastHint: HintKind | null = null;
  private lastHudAt = 0;
  private stompAt = 0;

  constructor() {
    super('run');
  }

  create(cfg: RunConfig) {
    this.cfg = cfg;
    this.rng = makeRng(cfg.seed);
    this.distancePx = 0;
    this.gearCount = 0;
    this.nextSpawnAt = 420;
    this.zoneIdx = 0;
    this.chasing = false;
    this.power = null;
    this.invulnUntil = 0;
    this.over = false;
    this.lastHint = null;
    this.tutorialQueue = cfg.tutorial ? [...TUTORIAL_PATTERNS] : [];

    this.layers = this.makeLayers(ZONES[0]);

    const groundBody = this.add
      .rectangle(VIEW_W / 2, GROUND_Y + 30, VIEW_W * 2, 60)
      .setVisible(false);
    this.physics.add.existing(groundBody, true);

    this.player = new Player(this, PLAYER_X);
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
      .image(-140, GROUND_Y + 2, 'robot0')
      .setOrigin(0.5, 1)
      .setDepth(8);
    this.shield = this.add.image(0, 0, 'bubble').setDepth(12).setVisible(false);
    this.flame = this.add.image(0, 0, 'flame').setDepth(9).setVisible(false);

    this.setupInput();

    if (cfg.debug) this.debug = new DebugOverlay(this);
    else this.debug = undefined;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.input.keyboard?.removeAllListeners(),
    );
    this.emit(EVENTS.zone, { index: 0, name: ZONES[0].name });
    this.emitHud(true);
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

    // Two fingers at once (jump while sliding) needs a second pointer.
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Touch: left half slides, right half jumps. Mouse: click jumps.
      if (p.wasTouch && p.x < VIEW_W / 2) {
        this.slidePointers.add(p.id);
        this.doSlide();
      } else {
        this.doJump();
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.slidePointers.delete(p.id)) this.player.releaseSlide();
      else this.player.releaseJump();
    });
  }

  private slidePointers = new Set<number>();
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
    const r = this.player.jump();
    if (r === 'jump') sfx.jump();
    if (r === 'double') sfx.doubleJump();
  }

  private doSlide() {
    if (this.over) return;
    if (this.player.slide(this.time.now)) sfx.slide();
  }

  // ---------------------------------------------------------------- loop

  update(time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    const m = metres(this.distancePx, PX_PER_METRE);
    this.speed = this.over ? Math.max(0, this.speed - 900 * dt) : speedAt(m, this.cfg.slowMode);
    this.distancePx += this.speed * dt;

    this.layers.far.tilePositionX += this.speed * dt * 0.12;
    this.layers.mid.tilePositionX += this.speed * dt * 0.4;
    this.layers.ground.tilePositionX += this.speed * dt;

    for (const g of [this.obstacles, this.gears, this.powers]) {
      for (const child of g.getChildren() as ArcadeSprite[]) {
        if (!child.active) continue;
        child.setVelocityX(-this.speed);
        if (child.x < -120) child.disableBody(true, true);
      }
    }

    if (!this.over) {
      if (this.distancePx >= this.nextSpawnAt) this.spawnNext(m);
      const zi = zoneIndexAt(m);
      if (zi !== this.zoneIdx) this.changeZone(zi);
      this.updateChase(isBossChase(m), time);
      this.updatePower(time);
      this.updateTutorial();
      this.pollGamepad();
    }

    this.player.update(time, this.distancePx);
    this.shield.setVisible(this.power === 'shield' && !this.player.dead);
    if (this.shield.visible) this.shield.setPosition(this.player.box.x, this.player.box.y - 42);
    this.flame.setVisible(this.power === 'jetpack');
    if (this.flame.visible) {
      this.flame.setPosition(
        this.player.box.x - 14,
        this.player.box.y - 26 + (time % 120 < 60 ? 0 : 2),
      );
    }
    // Blink while briefly invulnerable.
    const blink = time < this.invulnUntil && Math.floor(time / 80) % 2 === 0;
    this.player.head.setAlpha(blink ? 0.4 : 1);
    this.player.bodySprite.setAlpha(blink ? 0.4 : 1);

    if (time - this.lastHudAt > 100) this.emitHud();
    this.debug?.update({
      speed: this.speed,
      metres: m,
      zone: ZONES[this.zoneIdx % ZONES.length].id,
      seed: this.cfg.seed,
      objects: this.obstacles.countActive() + this.gears.countActive() + this.powers.countActive(),
      power: this.power,
    });
  }

  // ---------------------------------------------------------------- spawning

  private zone(): ZoneArt {
    return ZONES[this.zoneIdx % ZONES.length];
  }

  private spawnNext(m: number) {
    let pattern: Pattern;
    let tutorial = false;
    if (this.tutorialQueue.length) {
      pattern = this.tutorialQueue.shift()!;
      tutorial = true;
    } else if (this.power === 'jetpack') {
      pattern = 'gearsLine';
    } else {
      pattern = pickPattern(this.rng, m, this.power !== null);
    }
    this.spawnPattern(pattern, tutorial);
    const gap = nextGapPx(this.rng, m, this.chasing, this.cfg.slowMode);
    this.nextSpawnAt = this.distancePx + (tutorial ? gap * 1.8 : gap);
  }

  private spawnPattern(p: Pattern, tutorial: boolean) {
    const z = this.zone();
    const x = SPAWN_X;
    switch (p) {
      case 'low':
        this.addObstacle(z.low.key, x, false, tutorial ? 'jump' : null);
        break;
      case 'crate':
        this.addObstacle('crate', x, false, null);
        break;
      case 'high':
        this.addObstacle(z.high.key, x, true, tutorial ? 'slide' : null);
        break;
      case 'lowLow':
        this.addObstacle(z.low.key, x, false, null);
        this.addObstacle('crate', x + 70, false, null);
        break;
      case 'lowGears': {
        this.addObstacle(z.low.key, x, false, tutorial ? 'jump' : null);
        for (let i = 0; i < 5; i++) {
          const t = (i - 2) / 2;
          this.addGear(x + (i - 2) * 30, GROUND_Y - 70 - 60 * (1 - t * t));
        }
        break;
      }
      case 'highGears':
        this.addObstacle(z.high.key, x, true, tutorial ? 'slide' : null);
        for (let i = 0; i < 4; i++) this.addGear(x - 20 + i * 24, GROUND_Y - 18);
        break;
      case 'gearsLine': {
        const y =
          this.power === 'jetpack' ? 140 : this.rng() < 0.5 ? GROUND_Y - 20 : GROUND_Y - 120;
        for (let i = 0; i < 6; i++) this.addGear(x + i * 26, y);
        break;
      }
      case 'power': {
        const id = POWERS[Math.floor(this.rng() * POWERS.length)];
        const s = this.powers.get(x, GROUND_Y - 80, id) as ArcadeSprite;
        this.revive(s, x, GROUND_Y - 80, id);
        s.setData('power', id).setDepth(6);
        this.tweens.add({ targets: s, y: '-=8', duration: 400, yoyo: true, repeat: -1 });
        break;
      }
    }
  }

  private revive(s: ArcadeSprite, x: number, y: number, key: string) {
    s.setTexture(key);
    s.enableBody(true, x, y, true, true);
    s.setAngle(0).setAlpha(1).setScale(1);
    this.tweens.killTweensOf(s);
  }

  private addObstacle(key: string, x: number, high: boolean, hint: HintKind | null) {
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
  }

  private addGear(x: number, y: number) {
    const g = this.gears.get(x, y, 'gear') as ArcadeSprite;
    this.revive(g, x, y, 'gear');
    g.setDepth(6);
    this.tweens.add({ targets: g, angle: 360, duration: 900, repeat: -1 });
  }

  // ---------------------------------------------------------------- collisions

  private hitObstacle(o: ArcadeSprite) {
    if (this.over || !o.active || this.player.flying || this.time.now < this.invulnUntil) return;

    // During the tutorial, a mistake is a lesson, not a game over.
    const hint = o.getData('hint') as HintKind | null;
    if (hint) {
      o.disableBody(true, true);
      this.invulnUntil = this.time.now + 800;
      this.emit(EVENTS.hint, 'again');
      return;
    }

    if (this.power === 'shield') {
      this.power = null;
      o.disableBody(true, true);
      this.invulnUntil = this.time.now + 700;
      sfx.shieldBreak();
      this.burst(o.x, o.y, 0x78dcff);
      return;
    }

    this.over = true;
    sfx.hit();
    if (this.cfg.vibration) navigator.vibrate?.(200);
    if (!this.cfg.reducedMotion) this.cameras.main.shake(250, 0.012);
    this.robot.setVisible(false);
    this.player.die(() => {
      this.emit(EVENTS.over, {
        metres: metres(this.distancePx, PX_PER_METRE),
        gears: this.gearCount,
      });
    });
  }

  private collectGear(g: ArcadeSprite) {
    if (!g.active || this.player.dead) return;
    g.disableBody(true, true);
    this.gearCount++;
    sfx.gear();
    this.burst(g.x, g.y, this.zone().accent, 4);
  }

  private collectPower(s: ArcadeSprite) {
    if (!s.active || this.player.dead) return;
    const id = s.getData('power') as PowerId;
    s.disableBody(true, true);
    sfx.power();
    this.power = id;
    this.powerUntil = this.time.now + POWER_SECONDS[id] * 1000;
    if (id === 'jetpack') this.player.setFlying(true);
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
    return {
      sky: this.add.image(0, 0, `${z.id}-sky`).setOrigin(0).setDepth(0),
      far: this.add
        .tileSprite(0, GROUND_Y - LAYER_SIZE.h - 20, VIEW_W, LAYER_SIZE.h, `${z.id}-far`)
        .setOrigin(0)
        .setDepth(1),
      mid: this.add
        .tileSprite(0, GROUND_Y - LAYER_SIZE.h + 10, VIEW_W, LAYER_SIZE.h, `${z.id}-mid`)
        .setOrigin(0)
        .setDepth(2),
      ground: this.add
        .tileSprite(0, GROUND_Y, VIEW_W, GROUND_TILE.h, `${z.id}-ground`)
        .setOrigin(0)
        .setDepth(3),
    };
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
    sfx.zap();
    if (!this.cfg.reducedMotion) this.cameras.main.flash(250, 255, 255, 255);
    const lap = Math.floor(index / ZONES.length);
    this.emit(EVENTS.zone, { index, name: lap ? `${z.name} (lap ${lap + 1})` : z.name });
  }

  private updateChase(chase: boolean, time: number) {
    if (chase !== this.chasing) {
      this.chasing = chase;
      this.tweens.killTweensOf(this.robot);
      this.tweens.add({
        targets: this.robot,
        x: chase ? 46 : -140,
        duration: chase ? 900 : 600,
        ease: 'Sine.out',
      });
      this.emit(EVENTS.chase, chase);
    }
    if (this.robot.x > -100) {
      this.robot.setTexture(Math.floor(time / 220) % 2 ? 'robot1' : 'robot0');
      if (chase && time > this.stompAt) {
        this.stompAt = time + 660;
        sfx.robot();
        if (!this.cfg.reducedMotion) this.cameras.main.shake(80, 0.003);
      }
    }
  }

  // ---------------------------------------------------------------- tutorial + events

  private updateTutorial() {
    if (!this.cfg.tutorial) return;
    let hint: HintKind | null = null;
    for (const o of this.obstacles.getChildren() as ArcadeSprite[]) {
      const h = o.active ? (o.getData('hint') as HintKind | null) : null;
      if (h && o.x > this.player.box.x && o.x - this.player.box.x < 280) hint = h;
    }
    const finished =
      this.tutorialQueue.length === 0 && !hint && this.distancePx > this.nextSpawnAt - 10;
    if (!hint && finished && this.lastHint !== 'done') hint = 'done';
    if (hint && hint !== this.lastHint) {
      this.lastHint = hint;
      this.emit(EVENTS.hint, hint);
      if (hint === 'done') this.cfg.tutorial = false;
    } else if (!hint && this.lastHint && this.lastHint !== 'done') {
      this.lastHint = null;
      this.emit(EVENTS.hint, null);
    }
  }

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
