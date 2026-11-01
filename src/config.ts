/** Working name. Change it here (and in index.html / vite.config.ts manifest). */
export const GAME_NAME = 'Pixel Me In';

/** Virtual game resolution. Pixel art is drawn at this size and scaled up. */
export const VIEW_W = 640;
export const VIEW_H = 360;

/** Size of the stored, normalized face crop (square, pixels). */
export const FACE_SIZE = 256;

/** Size of the in-game head texture (square, pixels). Pixel sizes must divide it. */
export const HEAD_SIZE = 48;

/** Distance unit shown to the player: this many world pixels = 1 metre. */
export const PX_PER_METRE = 40;

/** A new zone starts every this many metres. */
export const ZONE_LENGTH_M = 500;
