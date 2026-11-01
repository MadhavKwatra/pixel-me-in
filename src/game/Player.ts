import Phaser from 'phaser';
import { BODY_FRAMES, BODY_H, BODY_W, NECK, type BodyFrame } from '../art/body';
import { GROUND_Y } from '../art/world';
import { HEAD_FRAME, HEAD_PIVOT } from '../face/renderAvatar';

const JUMP_V = -640;
const DOUBLE_JUMP_V = -560;
const SHORT_HOP_V = -260;
const FAST_FALL_V = 720;
const SLIDE_MIN_MS = 450;

/** Hitboxes are smaller than the art on purpose: near misses feel fair. */
const STAND = { w: 22, h: 64, ox: 9, oy: 4 };
const SLIDE = { w: 40, h: 38, ox: 0, oy: 30 };
const OBJ = { w: 40, h: 68 };

/**
 * The player: an invisible physics box, plus a body sprite and the face head
 * that follow it. Keeping the head separate lets it bob and tilt.
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
  flying = false;
  dead = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
  ) {
    this.box = scene.add.rectangle(x, GROUND_Y, OBJ.w, OBJ.h).setOrigin(0.5, 1).setVisible(false);
    scene.physics.add.existing(this.box);
    this.body = this.box.body as Phaser.Physics.Arcade.Body;
    this.setHitbox(STAND);

    this.bodySprite = scene.add.image(x, GROUND_Y, 'body', 'run0').setOrigin(0.5, 1).setDepth(10);
    this.head = scene.add
      .image(x, GROUND_Y, 'head')
      .setOrigin(HEAD_PIVOT.x / HEAD_FRAME, HEAD_PIVOT.y / HEAD_FRAME)
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

  /** Returns 'jump' | 'double' | null so the scene can play the right sound. */
  jump(): 'jump' | 'double' | null {
    if (this.dead || this.flying) return null;
    if (this.sliding) this.endSlide(true);
    if (this.onGround) {
      this.body.setVelocityY(JUMP_V);
      this.canDouble = true;
      return 'jump';
    }
    if (this.canDouble) {
      this.body.setVelocityY(DOUBLE_JUMP_V);
      this.canDouble = false;
      return 'double';
    }
    return null;
  }

  /** Let go of jump early = smaller hop. */
  releaseJump() {
    if (this.body.velocity.y < SHORT_HOP_V) this.body.setVelocityY(SHORT_HOP_V);
  }

  slide(time: number): boolean {
    if (this.dead || this.flying) return false;
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

  /** Called every frame. `distancePx` drives the run animation so legs match speed. */
  update(time: number, distancePx: number) {
    if (this.dead) return;
    if (this.sliding && this.onGround) this.endSlide();
    // Landed from a fast fall while holding slide: start sliding.
    if (!this.sliding && this.slideHeld && this.onGround && !this.flying) this.slide(time);

    if (this.flying) {
      const targetY = 170;
      this.box.y += (targetY - this.box.y) * 0.08;
      this.body.setVelocityY(0);
    }

    let frame: BodyFrame;
    if (this.sliding) frame = 'slide';
    else if (!this.onGround || this.flying) frame = 'jump';
    else frame = BODY_FRAMES[Math.floor(distancePx / 14) % 4];
    this.syncVisuals(frame);
  }

  syncVisuals(frame: BodyFrame) {
    const x = this.box.x;
    const feet = this.box.y;
    this.bodySprite.setPosition(x, feet).setFrame(frame);
    const neck = NECK[frame];
    const bob = frame === 'run0' || frame === 'run2' ? 1 : 0;
    this.head.setPosition(x - BODY_W / 2 + neck.x, feet - BODY_H + neck.y + bob);
    if (frame === 'slide') this.head.setRotation(-0.3);
    else if (frame === 'jump')
      this.head.setRotation(Phaser.Math.Clamp(this.body.velocity.y / 4000, -0.12, 0.12));
    else this.head.setRotation(0);
  }

  /** Death: the physics stops and the character tumbles off screen. */
  die(onDone: () => void) {
    this.dead = true;
    this.body.enable = false;
    const parts = [this.bodySprite, this.head];
    this.scene.tweens.add({
      targets: parts,
      y: '-=40',
      duration: 220,
      ease: 'Quad.out',
      yoyo: false,
      onComplete: () => {
        this.scene.tweens.add({
          targets: parts,
          y: '+=320',
          angle: '+=200',
          duration: 650,
          ease: 'Quad.in',
          onComplete: onDone,
        });
      },
    });
  }

  get headCenter() {
    return { x: this.head.x, y: this.head.y - 24 };
  }
}
