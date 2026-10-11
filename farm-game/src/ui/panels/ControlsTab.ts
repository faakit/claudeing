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
import { replayTutorial } from '../../systems/tutorial';
import type { MenuTabContext } from './MenuPanel';
import { t, type Key } from '../../i18n';
import { onOff } from './onOff';

const SIZE_KEY = { s: 'controls.sizeS', m: 'controls.sizeM', l: 'controls.sizeL' } as const;

/** Whether Options shows the Controls page (kept while the menu is reopened, until Back). */
export const controlsPage = { open: false };

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
    label: (s) => t('controls.autoTool', { state: onOff(s.settings.controls.autoTool) }),
    run: (s) => (toggleControl(s, 'autoTool'), 'settings'),
  },
  {
    id: 'tapToMove',
    label: (s) => t('controls.tapToWalk', { state: onOff(s.settings.controls.tapToMove) }),
    run: (s) => (toggleControl(s, 'tapToMove'), 'settings'),
  },
  {
    id: 'paint',
    label: (s) => t('controls.paint', { state: onOff(s.settings.controls.paint) }),
    run: (s) => (toggleControl(s, 'paint'), 'settings'),
  },
  {
    id: 'twoSpeed',
    label: (s) => t('controls.fineStick', { state: onOff(s.settings.controls.twoSpeed) }),
    run: (s) => (toggleControl(s, 'twoSpeed'), 'settings'),
  },
  {
    id: 'stickSize',
    label: (s) =>
      t('controls.stickSize', { size: t(SIZE_KEY[s.settings.controls.stickSize]) }),
    run: (s) => (cycleStickSize(s), 'settings'),
  },
  {
    id: 'leftHanded',
    label: (s) => t('opts.leftHand', { state: onOff(s.settings.leftHanded) }),
    run: (s) => (toggleLeftHanded(s), 'settings'),
  },
  {
    id: 'vibrate',
    label: (s) => t('opts.vibrate', { state: onOff(s.settings.vibrate) }),
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
  c.button(8, y, c.width - 16, 22, t('common.back'), back, { textColor: C.creamDim });
  const rows = Math.ceil(ITEMS.length / 2);
  for (let row = rows - 1; row >= 0; row--) {
    y -= 26;
    for (let col = 0; col < 2; col++) {
      const it = ITEMS[row * 2 + col];
      if (!it) {
        // The free half of the last row: replay the guided start from its first step that applies.
        c.button(
          8 + col * 92,
          y,
          half,
          22,
          t('controls.replayGuide'),
          () => {
            replayTutorial(getState());
            controlsPage.open = false;
            c.close();
          },
          { textColor: C.gold },
        );
        continue;
      }
      c.button(8 + col * 92, y, half, 22, it.label(s), () => {
        if (it.run(s) === 'haptics') haptic('tick');
        else gameEvents.emit('settingsChanged', undefined);
        c.rebuild();
      });
    }
  }
  y -= 16;
  c.label(8, y, t('controls.title'), C.gold);
  c.label(
    8,
    c.top + 4,
    t('controls.help'),
    C.creamDim,
    1,
    'left',
    184,
  );
}

/** The four one-thumb gestures, for the help card: a picture and two short lines each (tests measure them). */
export const HELP_ICONS = ['tap', 'paint', 'stick', 'ring'] as const;
/** The card's two lines for each picture, in the current language. */
export const helpLines = (icon: (typeof HELP_ICONS)[number]): [string, string] => [
  t(`help.${icon}1` as Key),
  t(`help.${icon}2` as Key),
];
/** Kept for the tests that measure the card: the four pictures with their lines, now. */
export const helpItems = (): { icon: (typeof HELP_ICONS)[number]; lines: [string, string] }[] =>
  HELP_ICONS.map((icon) => ({ icon, lines: helpLines(icon) }));

/**
 * A compact "how to play" card (M7): four pictures with two lines each, in a 2 x 2 grid 184 px wide and 56 px
 * tall. Shown at the top of Options (two taps from anywhere: Menu, Opts). Drawn with theme tokens only.
 */
export function drawHelpCard(c: MenuTabContext, x: number, y: number): void {
  const g = c.scene.add.graphics();
  c.add(g);
  helpItems().forEach((it, i) => {
    const cx = x + (i % 2) * 92;
    const cy = y + Math.floor(i / 2) * 28;
    const ix = cx + 9;
    const iy = cy + 10;
    g.fillStyle(C.ink, 0.5).fillCircle(ix, iy, 9);
    g.fillStyle(C.cream, 1);
    if (it.icon === 'tap') {
      g.fillCircle(ix, iy, 2.5);
      g.lineStyle(1, C.cream, 0.8).strokeCircle(ix, iy, 6);
    } else if (it.icon === 'paint') {
      for (const dx of [-5, 0, 5]) g.fillRect(ix + dx - 1.5, iy - 1.5, 3, 3);
      g.fillStyle(C.gold, 1).fillCircle(ix - 5, iy, 2.5);
    } else if (it.icon === 'stick') {
      g.lineStyle(1, C.cream, 0.8).strokeCircle(ix, iy, 6);
      g.fillCircle(ix + 3, iy - 2, 2.5);
    } else {
      for (const a of [200, 235, 270, 305, 340]) {
        const r = (a * Math.PI) / 180;
        g.fillRect(ix + Math.cos(r) * 6 - 1, iy + Math.sin(r) * 6 - 1, 2, 2);
      }
      g.fillStyle(C.gold, 1).fillCircle(ix, iy + 2, 2.5);
    }
    c.label(cx + 22, cy + 2, it.lines[0], C.cream);
    c.label(cx + 22, cy + 12, it.lines[1], C.creamDim);
  });
}
