# Game design

## Pitch

You get "digitized" into a pixel-art world and run as far as you can. Your own face is the hero.

## Modes

| Mode                  | Status | Notes                                                                                              |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| **Zone Run**          | v1 ✅  | Endless runner. New world every 500 m. Robot chase in the last 90 m of each zone.                  |
| **Photo Booth**       | v1 ✅  | Dress up the avatar, save/share a picture.                                                         |
| **Debug view**        | v1 ✅  | `?debug` or Konami code. Hitboxes, FPS, seed, speed.                                               |
| Skate mode            | v2     | Skateboard / inline skates. Rails to grind, ramps, air tricks, combo score.                        |
| Dev mode ("Bug Hunt") | v2     | Coder theme: jump bugs, slide under merge-conflict walls, coffee + semicolons, "Prod Outage" boss. |
| Daily Run             | v2     | Same seed for everyone each day (`makeRng(seed)` is ready).                                        |
| Friends mode          | later  | A friend's face on the robot.                                                                      |

## Controls

| Action             | Keyboard           | Touch                                    | Gamepad        |
| ------------------ | ------------------ | ---------------------------------------- | -------------- |
| Jump / double jump | Space, ↑, W, click | Tap anywhere / swipe up (or Jump button) | A / d-pad up   |
| Short hop          | Release jump early | Release early                            | Release early  |
| Slide / fast fall  | ↓, S (hold)        | Swipe down + hold (or Slide button)      | B / d-pad down |
| Pause              | Esc, P             | II button                                | Start          |

## Zones (`src/art/world.ts`)

| #   | Zone          | Low obstacle (jump) | High obstacle (slide) |
| --- | ------------- | ------------------- | --------------------- |
| 1   | Backyard      | Garden gnome        | Clothesline           |
| 2   | Rollercoaster | Traffic cone        | Coaster bar           |
| 3   | Beach         | Sandcastle          | Seagull               |
| 4   | Space         | Moon rock           | UFO                   |

A wooden crate appears in every zone. After Space, the zones loop ("lap 2").

## Balance (`src/game/rules.ts`)

- Speed: 230 px/s → +0.12 px/s per metre → max 520 px/s. Slow mode: ×0.75.
- 40 world px = 1 m. Gap between patterns: 1.7 s → 0.95 s with difficulty, random ×0.85–1.3, ×0.8 in a robot chase, never below 0.8 s.
- Jump −640 px/s, double jump −560, gravity 1900. High obstacles start 60 px above the ground; standing hitbox is 64 px tall, sliding 38 px.
- Power-ups: first at 120 m, then at least one every 250 m (10 % chance per pattern in between), never while one is active.
- Feel: jump buffer 130 ms, coyote time 90 ms, extra fall gravity +1000, apex float while jump is held.

## Tutorial (first run)

Jump → slide → double jump → grab a power-up. Time slows to 25 % near each lesson until the player does the move. Replay it from How to play.

## The robot

- **Robot Rush** (last 90 m of each zone): instead of normal obstacles the robot attacks, always with a warning – laser (blinking line for 0.8 s → slide) or bomb (red ring where it lands → jump). It gets zapped away when the zone changes.
- **Stumble** (final, owner's pick 2026-11-02): first crash = stumble + slowdown, the robot stays right behind you for 6 s; crash again in that time = caught. A shield still absorbs a crash.

## Power-ups

| Power   | Effect                                                                   |
| ------- | ------------------------------------------------------------------------ |
| Shield  | Survive one crash (then 0.7 s invulnerable).                             |
| Magnet  | Gears within 200 px fly to you, 8 s.                                     |
| Jetpack | Fly high and safe for 5 s, gears only; 1.2 s invulnerable after landing. |

## Unlocks (`src/storage/unlocks.ts`)

| Item                | Rule               |
| ------------------- | ------------------ |
| Crown, Space helmet | Best run ≥ 1,500 m |
| 3D glasses          | 150 gears in total |
| Space suit          | 5,000 m in total   |
| Lab coat            | 10 runs            |

## Look and feel

- Pixel art at 640×360, everything drawn in code. Big-head ("bobblehead") character so the face is easy to see.
- The "digitizer" intro (flash → face breaks into pixels → ZAP) is the nod to the inspiring episode.
- Chiptune sound effects made with Web Audio (`src/audio/sfx.ts`).
