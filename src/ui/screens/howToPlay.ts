/** How to play: shows the controls for the device in use first. */
import { setSettings } from '../../storage/local';
import type { Screen } from '../app';
import { hasGamepad, isTouch } from '../device';
import { onActions, render, toast } from '../dom';

type Kind = 'touch' | 'keys' | 'pad';

const CONTROLS: Record<Kind, { label: string; rows: [string, string][] }> = {
  touch: {
    label: 'Touch',
    rows: [
      ['Jump', 'Tap the RIGHT half of the screen. Tap again in the air for a double jump.'],
      ['Slide', 'Hold the LEFT half. In the air, this drops you fast.'],
      ['Pause', 'The II button, top right.'],
    ],
  },
  keys: {
    label: 'Keyboard',
    rows: [
      [
        'Jump',
        'Space, ↑ or W (or click). Press again in the air for a double jump. Let go early for a small hop.',
      ],
      ['Slide', 'Hold ↓ or S. In the air, this drops you fast.'],
      ['Pause', 'Esc or P.'],
    ],
  },
  pad: {
    label: 'Gamepad',
    rows: [
      ['Jump', 'A (or d-pad up).'],
      ['Slide', 'B (or d-pad down).'],
      ['Pause', 'Start.'],
    ],
  },
};

export const howToPlayScreen: Screen = (app, root) => {
  let kind: Kind = hasGamepad() ? 'pad' : isTouch() ? 'touch' : 'keys';

  const draw = () => {
    render(
      root,
      `<div class="panel">
        <h2>How to play</h2>
        <p>You run by yourself. Jump over things on the ground, slide under things in the air, and grab gears.</p>
        <div class="choices" role="group" aria-label="Controls for">
          ${(Object.keys(CONTROLS) as Kind[])
            .map(
              (k) =>
                `<button class="choice" data-action="kind" data-k="${k}" aria-pressed="${k === kind}">${CONTROLS[k].label}</button>`,
            )
            .join('')}
        </div>
        <dl>
          ${CONTROLS[kind].rows.map(([a, b]) => `<dt><strong>${a}</strong></dt><dd>${b}</dd>`).join('')}
        </dl>
        <h3>Power-ups</h3>
        <ul>
          <li><strong>Shield</strong> (blue): survive one crash.</li>
          <li><strong>Magnet</strong> (red): pulls gears to you for 8 s.</li>
          <li><strong>Jetpack</strong> (purple): fly over everything for 5 s.</li>
        </ul>
        <h3>Worlds</h3>
        <p>Every 500 m you are zapped to a new world: Backyard → Rollercoaster → Beach → Space. Just before each zap, the robot chases you.</p>
        <div class="row center">
          <button class="btn" data-action="tutorial">Replay tutorial</button>
          <button class="btn btn-ghost" data-action="back" autofocus>Back</button>
        </div>
      </div>`,
    );
  };

  onActions(root, {
    kind: (el) => {
      kind = el.dataset.k as Kind;
      draw();
      root.querySelector<HTMLElement>(`[data-k="${kind}"]`)?.focus();
    },
    tutorial: () => {
      setSettings({ tutorialDone: false });
      toast('The tutorial will play on your next run.');
    },
    back: () => app.go(app.backTo),
  });
  draw();
};
