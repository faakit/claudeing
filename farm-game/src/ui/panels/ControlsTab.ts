/**
 * Options > Controls: the one-thumb control scheme switches. Laid out from the bottom of the tab area up, so
 * the rows sit near the tab strip, where the thumb already is.
 */
import { setHapticsEnabled, haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import { gameEvents } from '../../systems/events';
import {
  cycleStickSize,
  toggleControl,
  toggleLeftHanded,
  toggleVibration,
} from '../../systems/settings';
import { C } from '../theme';
import type { MenuTabContext } from './MenuPanel';

const SIZE_NAME = { s: 'S', m: 'M', l: 'L' } as const;

/** Whether Options shows the Controls page (kept while the menu is reopened, until Back). */
export const controlsPage = { open: false };
const onOff = (on: boolean) => (on ? 'ON' : 'OFF');

type GameStateT = ReturnType<typeof getState>;

interface ControlItem {
  id: string;
  label: (s: GameStateT) => string;
  run: (s: GameStateT) => 'settings' | 'haptics';
}

/** Every switch on the page, in order (only the ones shipped so far are listed). */
const ITEMS: ControlItem[] = [
  {
    id: 'autoTool',
    label: (s) => `Auto tool: ${onOff(s.settings.controls.autoTool)}`,
    run: (s) => (toggleControl(s, 'autoTool'), 'settings'),
  },
  {
    id: 'stickSize',
    label: (s) => `Stick size: ${SIZE_NAME[s.settings.controls.stickSize]}`,
    run: (s) => (cycleStickSize(s), 'settings'),
  },
  {
    id: 'leftHanded',
    label: (s) => `Left hand: ${onOff(s.settings.leftHanded)}`,
    run: (s) => (toggleLeftHanded(s), 'settings'),
  },
  {
    id: 'vibrate',
    label: (s) => `Vibrate: ${onOff(s.settings.vibrate)}`,
    run: (s) => (setHapticsEnabled(toggleVibration(s)), 'haptics'),
  },
];

/** Button labels (also measured by tests so they always fit a half-width button). */
export const controlLabels = (s: GameStateT): string[] => ITEMS.map((it) => it.label(s));

export function buildControlsPage(c: MenuTabContext, back: () => void): void {
  const s = getState();
  const half = 92;
  // Rows from the bottom of the tab area up: Back lowest, then the switches, two per row.
  let y = c.bottom - 26;
  c.button(8, y, c.width - 16, 22, 'Back', back, { textColor: C.creamDim });
  const rows = Math.ceil(ITEMS.length / 2);
  for (let row = rows - 1; row >= 0; row--) {
    y -= 26;
    for (let col = 0; col < 2; col++) {
      const it = ITEMS[row * 2 + col];
      if (!it) continue;
      c.button(8 + col * 92, y, half, 22, it.label(s), () => {
        if (it.run(s) === 'haptics') haptic('tick');
        else gameEvents.emit('settingsChanged', undefined);
        c.rebuild();
      });
    }
  }
  y -= 16;
  c.label(8, y, 'CONTROLS', C.gold);
  c.label(
    8,
    c.top + 4,
    'Auto tool: Action picks the hoe, seeds, can, scythe or pickaxe for the tile. The rod and things you place stay your choice.',
    C.creamDim,
    1,
    'left',
    184,
  );
}
