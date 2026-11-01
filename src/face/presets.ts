/**
 * Ready-made faces for players who do not want to use a photo.
 * Drawn at FACE_SIZE with the same eye/mouth anchors as a real normalized
 * face, so every style and accessory works the same way.
 */
import { FACE_SIZE } from '../config';
import { ctx2d, makeCanvas } from './canvas';
import { ANCHORS } from './geometry';

interface Preset {
  skin: string;
  hair: string;
  style: 'short' | 'long' | 'curly' | 'bald';
}

export const PRESETS: Preset[] = [
  { skin: '#f5c08e', hair: '#5f4130', style: 'short' },
  { skin: '#86512f', hair: '#0e0b0a', style: 'curly' },
  { skin: '#ffd5ae', hair: '#e2c290', style: 'long' },
  { skin: '#bb7a4a', hair: '#231914', style: 'long' },
  { skin: '#52301c', hair: '#0e0b0a', style: 'bald' },
  { skin: '#e7aa74', hair: '#b8502b', style: 'short' },
];

export function drawPreset(index: number): HTMLCanvasElement {
  const p = PRESETS[index % PRESETS.length];
  const S = FACE_SIZE;
  const c = makeCanvas(S);
  const ctx = ctx2d(c);
  const circle = (x: number, y: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // No background: the outline then hugs the head shape.

  if (p.style === 'long') {
    ctx.fillStyle = p.hair;
    ctx.fillRect(S * 0.18, S * 0.3, S * 0.64, S * 0.7);
  }
  // face
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.ellipse(S / 2, S * 0.55, S * 0.3, S * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // ears
  circle(S * 0.2, S * 0.52, S * 0.05, p.skin);
  circle(S * 0.8, S * 0.52, S * 0.05, p.skin);

  // hair on top
  ctx.fillStyle = p.hair;
  if (p.style === 'curly') {
    for (let i = 0; i < 9; i++)
      circle(S * (0.24 + i * 0.065), S * (0.24 + (i % 2) * 0.04), S * 0.08, p.hair);
  } else if (p.style !== 'bald') {
    ctx.beginPath();
    ctx.ellipse(S / 2, S * 0.3, S * 0.32, S * 0.17, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(S * 0.18, S * 0.28, S * 0.64, S * 0.08);
  }

  // eyes at the shared anchors
  const ey = S * ANCHORS.eyeY;
  for (const ex of [S * (0.5 - ANCHORS.eyeSpan / 2), S * (0.5 + ANCHORS.eyeSpan / 2)]) {
    circle(ex, ey, S * 0.055, '#ffffff');
    circle(ex + S * 0.012, ey, S * 0.03, '#231914');
    ctx.fillStyle = p.hair === '#e2c290' ? '#8a6243' : p.hair;
    ctx.fillRect(ex - S * 0.06, ey - S * 0.1, S * 0.12, S * 0.025);
  }
  // cheeks + smile
  circle(S * 0.3, S * 0.62, S * 0.035, 'rgba(224,138,128,0.6)');
  circle(S * 0.7, S * 0.62, S * 0.035, 'rgba(224,138,128,0.6)');
  ctx.strokeStyle = '#6b3f25';
  ctx.lineWidth = S * 0.025;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(S / 2, S * (ANCHORS.mouthY - 0.07), S * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  return c;
}

export function presetSkin(index: number): string {
  return PRESETS[index % PRESETS.length].skin;
}
