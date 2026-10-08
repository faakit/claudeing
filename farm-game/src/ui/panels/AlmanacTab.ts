import { collections, items } from '../../data';
import { getState } from '../../state/store';
import { discovered, pageDone, pageProgress } from '../../systems/almanac';
import { C } from '../theme';
import { fmt } from './format';
import type { MenuTabContext } from './MenuPanel';

/** Menu tab: every good you have found, page by page. Unfound items show as dark shapes. */
export function buildAlmanac(c: MenuTabContext): void {
  const s = getState();
  let y = c.top;
  for (const [id, page] of Object.entries(collections)) {
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
    y += 38;
  }
}
