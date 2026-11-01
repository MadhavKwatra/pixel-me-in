/** Small visual effects for the run: dust, pops and the "break into pixels" death. */
import Phaser from 'phaser';

/** A few soft puffs (running dust, landing). */
export function puff(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count: number,
  spread = 10,
  tint = 0xffffff,
) {
  for (let i = 0; i < count; i++) {
    const p = scene.add
      .image(x + (Math.random() - 0.5) * spread, y - Math.random() * 3, 'puff')
      .setDepth(9)
      .setTint(tint)
      .setAlpha(0.8)
      .setScale(0.6 + Math.random() * 0.6);
    scene.tweens.add({
      targets: p,
      x: p.x - 10 - Math.random() * 14,
      y: p.y - 4 - Math.random() * 8,
      alpha: 0,
      scale: p.scale * 1.6,
      duration: 320 + Math.random() * 200,
      onComplete: () => p.destroy(),
    });
  }
}

/** Floating "+1" text. */
export function popText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  colour = '#fff3b0',
) {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: colour,
      stroke: '#14121c',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(30);
  scene.tweens.add({
    targets: t,
    y: y - 22,
    alpha: 0,
    duration: 600,
    ease: 'Quad.out',
    onComplete: () => t.destroy(),
  });
}

/**
 * "De-digitize": the images break into their own coloured pixels, which fly
 * apart and fade. Fits the "zapped into a game" theme.
 */
export function dissolve(
  scene: Phaser.Scene,
  parts: Phaser.GameObjects.Image[],
  reducedMotion: boolean,
  onDone: () => void,
) {
  if (reducedMotion) {
    scene.tweens.add({ targets: parts, alpha: 0, duration: 400, onComplete: onDone });
    return;
  }
  const BLOCK = 3;
  for (const part of parts) {
    const frame = part.frame;
    const src = frame.source.image as HTMLCanvasElement;
    const ctx = src.getContext?.('2d');
    if (!ctx) continue;
    const { cutX, cutY, cutWidth: w, cutHeight: h } = frame;
    const data = ctx.getImageData(cutX, cutY, w, h).data;
    const left = part.x - part.displayOriginX * part.scaleX;
    const top = part.y - part.displayOriginY * part.scaleY;
    for (let by = 0; by < h; by += BLOCK) {
      for (let bx = 0; bx < w; bx += BLOCK) {
        const i = ((by + 1) * w + (bx + 1)) * 4;
        if (i >= data.length || data[i + 3] < 128) continue;
        const colour = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        const p = scene.add
          .image(left + bx + 1, top + by + 1, 'pixel')
          .setScale(BLOCK)
          .setTint(colour)
          .setDepth(20);
        const dx = (Math.random() - 0.3) * 120;
        const dy = -40 - Math.random() * 90;
        scene.tweens.add({
          targets: p,
          x: p.x + dx,
          y: p.y + dy,
          angle: (Math.random() - 0.5) * 360,
          duration: 450 + Math.random() * 250,
          ease: 'Quad.out',
          onComplete: () =>
            scene.tweens.add({
              targets: p,
              y: p.y + 140,
              alpha: 0,
              duration: 450,
              ease: 'Quad.in',
              onComplete: () => p.destroy(),
            }),
        });
      }
    }
    part.setVisible(false);
  }
  scene.time.delayedCall(950, onDone);
}
