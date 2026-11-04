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
      ['Jump', 'Tap anywhere (or swipe up). Tap again in the air for a double jump.'],
      ['Slide', 'Swipe down and hold. In the air, this drops you fast.'],
      ['Buttons', 'Prefer buttons? Settings → Touch buttons. Upright phones show them by default.'],
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
  const kind: Kind = hasGamepad() ? 'pad' : isTouch() ? 'touch' : 'keys';

  const draw = () => {
    render(
      root,
      `<div class="panel">
        <h2>How to play</h2>
        <p>You run by yourself. Jump over things on the ground, slide under things in the air, and grab every stick of RAM before the data center does. A normal stick is 1 GB, a rare RGB stick is 8 GB.</p>
        <h3>${CONTROLS[kind].label} controls</h3>
        <dl>
          ${CONTROLS[kind].rows.map(([a, b]) => `<dt><strong>${a}</strong></dt><dd>${b}</dd>`).join('')}
        </dl>
        <details>
          <summary>Other controls</summary>
          ${(Object.keys(CONTROLS) as Kind[])
            .filter((k) => k !== kind)
            .map(
              (k) =>
                `<h4>${CONTROLS[k].label}</h4><dl>${CONTROLS[k].rows.map(([a, b]) => `<dt><strong>${a}</strong></dt><dd>${b}</dd>`).join('')}</dl>`,
            )
            .join('')}
        </details>
        <h3>Power-ups</h3>
        <ul>
          <li><strong>Firewall</strong> (orange): blocks one crash.</li>
          <li><strong>Download More RAM</strong> (green): pulls RAM to you, and every stick counts double, for 8 s.</li>
          <li><strong>Jetpack</strong> (purple): fly over everything for 5 s.</li>
        </ul>
        <h3>The Utilizer</h3>
        <p>Every 500 m you are zapped to a new place: Your Desk → Data Center (more places coming). Near the end of each place, The Utilizer attacks: slide under his beam, jump over his cloud drops. If you trip, he runs right behind you and grabs a quarter of your RAM. Trip again while he is close and he gets you.</p>
        <div class="row center">
          <button class="btn" data-action="tutorial">Replay tutorial</button>
          <button class="btn btn-ghost" data-action="back" autofocus>Back</button>
        </div>
      </div>`,
    );
  };

  onActions(root, {
    tutorial: () => {
      setSettings({ tutorialDone: false });
      toast('The tutorial will play on your next run.');
    },
    back: () => app.go(app.backTo),
  });
  draw();
};
