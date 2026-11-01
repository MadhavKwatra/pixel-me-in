import Phaser from 'phaser';
import { BODY_H, BODY_W, LEAN, NECK, RUN_FRAMES, type BodyFrame } from '../art/body';
import { GROUND_Y } from '../art/world';
import { HEAD_FRAME } from '../face/renderAvatar';

const JUMP_V = -640;
const DOUBLE_JUMP_V = -560;
const SHORT_HOP_V = -260;
const FAST_FALL_V = 760;
const SLIDE_MIN_MS = 450;
/** Mario-style forgiveness: a jump pressed a little early or late still counts. */
const JUMP_BUFFER_MS = 130;
const COYOTE_MS = 90;
/** Falling is faster than rising (snappy arcs); the top of a held jump floats a little. */
const FALL_GRAVITY = 1000;
const APEX_GRAVITY = -700;
const LAND_MS = 110;
/** World pixels per run frame: legs move faster when the world moves faster. */
const PX_PER_RUN_FRAME = 11;

/** Hitboxes are smaller than the art on purpose: near misses feel fair. */
const STAND = { w: 22, h: 64, ox: 9, oy: 4 };
const SLIDE = { w: 40, h: 38, ox: 0, oy: 30 };
const OBJ = { w: 40, h: 68 };

export interface PlayerEvents {
  jump: (double: boolean) => void;
  land: (impact: number) => void;
}

/**
 * The player: an invisible physics box, plus a body sprite and the face head
 * that follow it. Keeping the head separate lets it bob, lean and squash.
 */
export class Player {
  readonly box: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly bodySprite: Phaser.GameObjects.Image;
  readonly head: Phaser.GameObjects.Image;

  private canDouble = true;
  private sliding = false;
  private slideHeld = false;
  private slideUntil = 0;
  private jumpHeld = false;
  private jumpPressedAt = -Infinity;
  private groundedAt = 0;
  private jumpedSinceGround = false;
  private wasOnGround = true;
  private landUntil = 0;
  private lastVy = 0;
  flying = false;
  dead = false;
  /** During "Ready… GO!" the player stands still. */
  frozen = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    private events: PlayerEvents,
  ) {
    this.box = scene.add.rectangle(x, GROUND_Y, OBJ.w, OBJ.h).setOrigin(0.5, 1).setVisible(false);
    scene.physics.add.existing(this.box);
    this.body = this.box.body as Phaser.Physics.Arcade.Body;
    this.setHitbox(STAND);

    this.bodySprite = scene.add.image(x, GROUND_Y, 'body', 'idle').setOrigin(0.5, 1).setDepth(10);
    // Where the chin sits on the neck; differs per face (set by controller.setAvatarTextures).
    const pivot = (scene.registry.get('headPivot') as { x: number; y: number }) ?? { x: 32, y: 53 };
    this.head = scene.add
      .image(x, GROUND_Y, 'head')
      .setOrigin(pivot.x / HEAD_FRAME, pivot.y / HEAD_FRAME)
      .setDepth(11);
  }

  private setHitbox(h: typeof STAND) {
    this.body.setSize(h.w, h.h, false).setOffset(h.ox, h.oy);
  }

  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  get isSliding() {
    return this.sliding;
  }

  /** Press jump. It may happen now, or a moment later when we land (jump buffer). */
  pressJump(time: number) {
    if (this.dead || this.flying || this.frozen) return;
    this.jumpHeld = true;
    this.jumpPressedAt = time;
    this.tryJump(time);
  }

  private tryJump(time: number): boolean {
    const coyote = !this.jumpedSinceGround && time - this.groundedAt < COYOTE_MS;
    if (this.onGround || coyote) {
      if (this.sliding) this.endSlide(true);
      this.body.setVelocityY(JUMP_V);
      this.canDouble = true;
      this.jumpedSinceGround = true;
      this.jumpPressedAt = -Infinity;
      this.stretch();
      this.events.jump(false);
      return true;
    }
    if (this.canDouble) {
      this.body.setVelocityY(DOUBLE_JUMP_V);
      this.canDouble = false;
      this.jumpPressedAt = -Infinity;
      this.stretch();
      this.events.jump(true);
      return true;
    }
    return false;
  }

  /** Touch taps and swipes: the jump is no longer "held", but is not cut short either. */
  softReleaseJump() {
    this.jumpHeld = false;
  }

  /** Let go of jump early = smaller hop. */
  releaseJump() {
    this.jumpHeld = false;
    if (this.body.velocity.y < SHORT_HOP_V) this.body.setVelocityY(SHORT_HOP_V);
  }

  slide(time: number): boolean {
    if (this.dead || this.flying || this.frozen) return false;
    this.slideHeld = true;
    if (!this.onGround) {
      this.body.setVelocityY(FAST_FALL_V);
      return false;
    }
    if (this.sliding) return false;
    this.sliding = true;
    this.slideUntil = time + SLIDE_MIN_MS;
    this.setHitbox(SLIDE);
    return true;
  }

  releaseSlide() {
    this.slideHeld = false;
  }

  private endSlide(force = false) {
    if (!this.sliding) return;
    if (!force && (this.slideHeld || this.scene.time.now < this.slideUntil)) return;
    this.sliding = false;
    this.setHitbox(STAND);
  }

  setFlying(on: boolean) {
    this.flying = on;
    this.body.setAllowGravity(!on);
    if (on) {
      this.endSlide(true);
      this.body.setVelocityY(0);
    }
  }

  /** Quick squash/stretch on the head – cartoon physics. */
  private stretch() {
    this.scene.tweens.killTweensOf(this.head);
    this.head.setScale(0.9, 1.12);
    this.scene.tweens.add({
      targets: this.head,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Back.out',
    });
  }

  private squash(impact: number) {
    const k = Math.min(1, Math.max(0, impact) / 900);
    this.scene.tweens.killTweensOf(this.head);
    this.head.setScale(1 + 0.14 * k, 1 - 0.14 * k);
    this.scene.tweens.add({
      targets: this.head,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.out',
    });
  }

  /** Called every frame. `distancePx` drives the run animation so legs match speed. */
  update(time: number, distancePx: number) {
    if (this.dead) return;
    const grounded = this.onGround;

    if (grounded) {
      this.groundedAt = time;
      if (!this.wasOnGround) {
        this.jumpedSinceGround = false;
        this.canDouble = true;
        this.landUntil = time + LAND_MS;
        this.squash(this.lastVy);
        this.events.land(this.lastVy);
        // Jump buffer: jump was pressed just before landing.
        if (time - this.jumpPressedAt < JUMP_BUFFER_MS) this.tryJump(time);
      }
    }
    this.wasOnGround = this.onGround;
    this.lastVy = this.body.velocity.y;

    // Gravity shaping (on top of the world gravity).
    if (!this.flying && !grounded) {
      const vy = this.body.velocity.y;
      if (vy > 0) this.body.setGravityY(FALL_GRAVITY);
      else if (this.jumpHeld && vy > -120) this.body.setGravityY(APEX_GRAVITY);
      else this.body.setGravityY(0);
    } else {
      this.body.setGravityY(0);
    }

    if (this.sliding && grounded) this.endSlide();
    // Landed from a fast fall while holding slide: start sliding.
    if (!this.sliding && this.slideHeld && grounded && !this.flying) this.slide(time);

    if (this.flying) {
      const targetY = 170;
      this.box.y += (targetY - this.box.y) * 0.08;
      this.body.setVelocityY(0);
    }

    let frame: BodyFrame;
    if (this.frozen) frame = 'idle';
    else if (time < this.stumbleUntil) frame = 'hurt';
    else if (this.sliding) frame = 'slide';
    else if (this.flying) frame = 'jump';
    else if (!this.onGround) frame = this.body.velocity.y < 60 ? 'jump' : 'fall';
    else if (time < this.landUntil) frame = 'land';
    else frame = RUN_FRAMES[Math.floor(distancePx / PX_PER_RUN_FRAME) % RUN_FRAMES.length];
    this.syncVisuals(frame);
  }

  syncVisuals(frame: BodyFrame) {
    const x = this.box.x;
    const feet = this.box.y;
    this.bodySprite.setPosition(x, feet).setFrame(frame);
    const neck = NECK[frame];
    this.head.setPosition(x - BODY_W / 2 + neck.x, feet - BODY_H + neck.y + 1);
    // Head follows the body lean a little, and tilts with the jump.
    let rot = LEAN[frame] * 0.35;
    if (frame === 'jump' || frame === 'fall') {
      rot += Phaser.Math.Clamp(this.body.velocity.y / 4000, -0.12, 0.12);
    }
    this.head.setRotation(rot);
  }

  private stumbleUntil = 0;

  /** Trip: a short hurt pose and a head wobble, then keep running. */
  stumble(now: number) {
    this.stumbleUntil = now + 300;
    if (this.sliding) this.endSlide(true);
    this.scene.tweens.add({
      targets: this.head,
      angle: { from: -18, to: 0 },
      duration: 380,
      ease: 'Back.out',
    });
  }

  /** Stop and show the hurt pose (the scene then breaks the character into pixels). */
  hurt() {
    this.dead = true;
    this.body.enable = false;
    this.syncVisuals('hurt');
  }

  /** Feet position, for dust and the shadow. */
  get feet() {
    return { x: this.box.x, y: this.box.y };
  }
}
