import { collections, items } from '../../data';
import { getState } from '../../state/store';
import { discovered, pageDone, pageProgress } from '../../systems/almanac';
import { C } from '../theme';
import { fmt } from './format';
import { legendsLine } from './bookText';
import type { MenuTabContext } from './MenuPanel';

/** Menu tab: every good you have found, page by page. Unfound items show as dark shapes. */
/** Book pages shown per screen; more pages get < and > buttons. */
export const BOOK_PER_SCREEN = 6;
let screen = 0;

export function buildAlmanac(c: MenuTabContext): void {
  const s = getState();
  let y = c.top;
  const all = Object.entries(collections);
  const screens = Math.max(1, Math.ceil(all.length / BOOK_PER_SCREEN));
  screen = Math.min(screen, screens - 1);
  if (screens > 1) {
    const by = c.bottom - 22;
    c.button(8, by, 40, 20, '<', () => {
      screen = (screen + screens - 1) % screens;
      c.rebuild();
    });
    c.label(100, by + 6, `${screen + 1}/${screens}`, C.creamDim, 1, 'center');
    c.button(152, by, 40, 20, '>', () => {
      screen = (screen + 1) % screens;
      c.rebuild();
    });
  }
  for (const [id, page] of all.slice(screen * BOOK_PER_SCREEN, (screen + 1) * BOOK_PER_SCREEN)) {
    const { have, total } = pageProgress(s, id);
    const done = pageDone(s, id);
    c.label(8, y, page.name.toUpperCase(), done ? C.green : C.gold);
    c.label(
      192,
      y,
      done ? 'Complete!' : `${have}/${total}  +${fmt(page.reward)}g`,
      done ? C.green : C.creamDim,
      1,
      'right',
    );
    page.items.forEach((item, i) => {
      const img = c.icon(16 + i * 17, y + 20, items[item]?.icon ?? 'ui_coin', 1);
      if (!discovered(s, item)) img.setTint(0x2a2238);
    });
    // Legendary fish are not on the page (it stays finishable), but their tally is (critique 7, F7).
    if (id === 'fish') c.label(192, y + 16, legendsLine(s), C.creamDim, 1, 'right');
    y += 38;
  }
}
