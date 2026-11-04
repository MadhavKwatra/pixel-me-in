// Draws the app icons and the social preview image as pixel art and writes
// them as PNGs into public/. No image libraries needed: a tiny PNG encoder
// built on Node's zlib. Run with: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');

// ---------- PNG encoding ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- tiny pixel canvas ----------
function canvas(w, h) {
  const data = Buffer.alloc(w * h * 4);
  const hex = (c) => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
  return {
    w,
    h,
    data,
    rect(x, y, rw, rh, c) {
      const [r, g, b] = hex(c);
      x = Math.floor(x);
      y = Math.floor(y);
      rw = Math.round(rw);
      rh = Math.round(rh);
      for (let yy = Math.max(0, y); yy < Math.min(h, y + rh); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(w, x + rw); xx++)
          data.set([r, g, b, 255], (yy * w + xx) * 4);
    },
  };
}

// 16x16 pixel face (the logo). '.' = transparent.
const FACE = [
  '.....HHHHHH.....',
  '...HHHHHHHHHH...',
  '..HHHHHHHHHHHH..',
  '.HHHSSSSSSSSHHH.',
  '.HHSSSSSSSSSSHH.',
  'KHSSSSSSSSSSSSHK',
  'KSSWWPSSSSWWPSSK',
  'KSSWWPSSSSWWPSSK',
  'KSSSSSSSSSSSSSSK',
  'KSCCSSSNNSSSCCSK',
  '.KSSSSSSSSSSSSK.',
  '.KSSSMSSSSMSSSK.',
  '..KSSSMMMMSSSK..',
  '...KSSSSSSSSK...',
  '....KKSSSSKK....',
  '......KKKK......',
];
const COLOURS = {
  H: '#5f4130',
  S: '#f5c08e',
  W: '#ffffff',
  P: '#231914',
  C: '#e08a80',
  N: '#d4915c',
  M: '#86512f',
  K: '#14121c',
};

function drawFace(c, ox, oy, px) {
  FACE.forEach((row, y) =>
    [...row].forEach(
      (ch, x) => ch !== '.' && c.rect(ox + x * px, oy + y * px, px, px, COLOURS[ch]),
    ),
  );
}

function icon(size, padFrac) {
  const c = canvas(size, size);
  c.rect(0, 0, size, size, '#1b1f3b');
  // pixel "screen" frame
  const px = Math.floor((size * (1 - padFrac * 2)) / 16);
  const off = Math.floor((size - px * 16) / 2);
  c.rect(off - px, off - px, px * 18, px * 18, '#e8c547');
  c.rect(off - px / 2, off - px / 2, px * 17, px * 17, '#9cc8f0');
  drawFace(c, off, off, px);
  return png(size, size, c.data);
}

mkdirSync(join(out, 'icons'), { recursive: true });
writeFileSync(join(out, 'icons', 'icon-192.png'), icon(192, 0.1));
writeFileSync(join(out, 'icons', 'icon-512.png'), icon(512, 0.1));
writeFileSync(join(out, 'icons', 'icon-maskable-512.png'), icon(512, 0.2)); // safe zone for round masks
writeFileSync(join(out, 'icons', 'apple-touch-icon.png'), icon(180, 0.1));
// og-image.png is drawn by scripts/og-image.mjs (real game art) – not here.

// SVG favicon from the same 16x16 face.
const rects = FACE.flatMap((row, y) =>
  [...row].map((ch, x) =>
    ch === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${COLOURS[ch]}"/>`,
  ),
).join('');
writeFileSync(
  join(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>\n`,
);
console.log('[make-icons] wrote icons and favicon.svg to public/');
