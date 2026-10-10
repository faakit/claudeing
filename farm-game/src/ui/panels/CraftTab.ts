import { items, recipes } from '../../data';
import { getState } from '../../state/store';
import { craft, craftBatch, craftBlock, plainBatch } from '../../systems/crafting';
import { countItem } from '../../systems/inventory';
import { audio } from '../../platform/audio';
import { isRecipeUnlocked } from '../../systems/skills';
import { lockedText, recipeNeed } from './craftText';
import { C } from '../theme';
import { ROW_H } from '../widgets';
import { fmt } from './format';
import type { MenuTabContext } from './MenuPanel';

const PER_PAGE = 8;

let page = 0;

/** Menu tab: everything you can make. Locked recipes stay visible so players know what to aim for. */
export function buildCraft(c: MenuTabContext): void {
  const s = getState();
  const ids = Object.keys(recipes).sort((a, b) => {
    const ua = isRecipeUnlocked(s, recipes[a]!) ? 0 : 1;
    const ub = isRecipeUnlocked(s, recipes[b]!) ? 0 : 1;
    return ua - ub;
  });
  const pages = Math.max(1, Math.ceil(ids.length / PER_PAGE));
  page = Math.min(page, pages - 1);
  c.label(8, c.top + 1, 'WORKBENCH', C.gold);
  c.label(192, c.top + 1, `Gold ${fmt(s.money)}`, C.gold, 1, 'right');
  let y = c.top + 14;
  for (const id of ids.slice(page * PER_PAGE, (page + 1) * PER_PAGE)) {
    const r = recipes[id]!;
    const unlocked = isRecipeUnlocked(s, r);
    const need = recipeNeed(r);
    const block = craftBlock(s, id);
    const batch = plainBatch(s, id, 5);
    y = c.row(y, {
      icon: items[r.output.item]?.icon,
      title: `${r.name}${r.output.qty > 1 ? ` x${r.output.qty}` : ''}`,
      sub: unlocked ? need : lockedText(s, r),
      subColor: !unlocked
        ? C.warn
        : block === 'no_items' || block === 'no_gold'
          ? C.red
          : C.creamDim,
      buttons: [
        // Make is always the outermost button, on every row (critique 10: the same column means the same thing).
        {
          label: 'Make',
          width: 38,
          enabled: block === null,
          color: block === null ? C.green : C.creamDim,
          onClick: () => {
            if (craft(getState(), id) === 'ok') audio.play('buy');
            else audio.play('error');
            c.rebuild();
          },
        },
        // Dishes come in batches: "x3" cooks as many as your plain ingredients make, up to five. The slot is
        // always there, inside Make (a dim "x1" when fewer than two can be made), so nothing slides under the
        // thumb after a batch (critique 9, F4).
        ...(r.kitchen && unlocked
          ? [
              {
                label: batch >= 2 && block === null ? `x${batch}` : 'x1',
                width: 24,
                enabled: batch >= 2 && block === null,
                color: batch >= 2 && block === null ? C.cream : C.creamDim,
                onClick: () => {
                  audio.play(craftBatch(getState(), id, batch) > 0 ? 'buy' : 'error');
                  c.rebuild();
                },
              },
            ]
          : []),
      ],
    });
  }
  if (pages > 1) {
    const by = c.bottom - 24;
    c.button(8, by, 40, 20, '<', () => {
      page = (page + pages - 1) % pages;
      c.rebuild();
    });
    c.label(100, by + 6, `${page + 1}/${pages}`, C.creamDim, 1, 'center');
    c.button(152, by, 40, 20, '>', () => {
      page = (page + 1) % pages;
      c.rebuild();
    });
  } else {
    c.label(
      8,
      c.bottom - 22,
      `You carry ${countItem(s, 'fiber')} fiber. Cut weeds with the scythe.`,
      C.creamDim,
      1,
      'left',
      184,
    );
  }
  void ROW_H;
}
