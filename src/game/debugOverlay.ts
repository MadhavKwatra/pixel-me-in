import Phaser from 'phaser';

/**
 * Developer view: hitboxes + live numbers. Turn on with `?debug` in the URL
 * or the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) on the menu.
 */
export class DebugOverlay {
  private text: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {
    scene.physics.world.drawDebug = true;
    if (!scene.physics.world.debugGraphic) scene.physics.world.createDebugGraphic();
    this.text = scene.add
      .text(6, 40, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#00ff88',
        backgroundColor: '#000000aa',
      })
      .setDepth(100)
      .setPadding(3);
  }

  update(info: Record<string, string | number | null>) {
    const fps = this.scene.game.loop.actualFps.toFixed(0);
    const lines = [
      `fps ${fps}`,
      ...Object.entries(info).map(([k, v]) => `${k} ${typeof v === 'number' ? Math.round(v) : v}`),
    ];
    this.text.setText(lines.join('\n'));
  }
}
