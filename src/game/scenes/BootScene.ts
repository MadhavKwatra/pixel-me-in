import Phaser from 'phaser';
import { GROUND_TILE, LAYER_SIZE, paint, SKY_SIZE, SPRITES, ZONES } from '../../art/world';

/**
 * Builds every world texture from code once, then waits.
 * The DOM UI starts RunScene through the GameController when the player presses Play.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    const add = (key: string, canvas: HTMLCanvasElement) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas);
    };
    for (const z of ZONES) {
      add(`${z.id}-sky`, paint(SKY_SIZE.w, SKY_SIZE.h, z.sky));
      add(`${z.id}-far`, paint(LAYER_SIZE.w, LAYER_SIZE.h, z.far));
      add(`${z.id}-mid`, paint(LAYER_SIZE.w, LAYER_SIZE.h, z.mid));
      add(`${z.id}-ground`, paint(GROUND_TILE.w, GROUND_TILE.h, z.ground));
      add(z.low.key, paint(z.low.w, z.low.h, z.low.draw));
      add(z.high.key, paint(z.high.w, z.high.h, z.high.draw));
    }
    for (const [key, s] of Object.entries(SPRITES)) add(key, paint(s.w, s.h, s.draw));
    add('bubble', paint(76, 92, bubble));
    this.game.events.emit('pmi:ready');
  }
}

function bubble(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - cx) / (w / 2), (y + 0.5 - cy) / (h / 2));
      if (d <= 1 && d > 0.93) {
        ctx.fillStyle = 'rgba(120, 220, 255, 0.9)';
        ctx.fillRect(x, y, 1, 1);
      } else if (d <= 0.93) {
        ctx.fillStyle = 'rgba(120, 220, 255, 0.12)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
