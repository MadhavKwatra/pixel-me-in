/**
 * A tiny pixel canvas for drawing sprites in code: dots, discs, thick lines,
 * rectangles, then a dark outline around everything (the classic 2D look).
 */
export interface P {
  x: number;
  y: number;
}

export const OUTLINE = '#14121c';

export class PixelGrid {
  readonly cells: (string | null)[];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = new Array(w * h).fill(null);
  }

  dot(x: number, y: number, c: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.dot(xx, yy, c);
    }
  }

  disc(cx: number, cy: number, r: number, c: string) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.dot(x, y, c);
      }
    }
  }

  line(a: P, b: P, r: number, c: string) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r, c);
    }
  }

  /** Add an outline around all filled pixels. */
  outline(c = OUTLINE) {
    const copy = this.cells.slice();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (copy[y * this.w + x]) continue;
        const near = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].some(
          ([xx, yy]) => xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && copy[yy * this.w + xx],
        );
        if (near) this.cells[y * this.w + x] = c;
      }
    }
  }

  drawTo(ctx: CanvasRenderingContext2D, ox: number, oy = 0) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.cells[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
}

export const along = (from: P, angle: number, len: number): P => ({
  x: from.x + Math.sin(angle) * len,
  y: from.y + Math.cos(angle) * len,
});
