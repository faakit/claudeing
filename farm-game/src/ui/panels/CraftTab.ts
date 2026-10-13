import { items, recipes } from '../../data';
import { getState } from '../../state/store';
import { craft, craftBatch, craftBlock, plainBatch } from '../../systems/crafting';
import { countItem } from '../../systems/inventory';
import { audio } from '../../platform/audio';
import { isRecipeUnlocked } from '../../systems/skills';
import { lockedText, recipeNeedLine } from './craftText';
import { C } from '../theme';
import { ROW_H, rowText, type RowSpec } from '../widgets';
import { fmt } from './format';
import type { MenuTabContext } from './MenuPanel';
import { t } from '../../i18n';

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
  // Pages packed by height: a row whose name wraps (pt-BR) is taller, and the menu cannot grow past its cap.
  const room = c.bottom - 24 - 2 - (c.top + 14);
  const book: string[][] = [[]];
  let used = 0;
  for (const id of ids) {
    const h = ROW_H + rowText(rowSpec(id), getState().settings.leftHanded).extra;
    const cur = book[book.length - 1]!;
    if (cur.length && (used + h > room || cur.length >= PER_PAGE)) {
      book.push([id]);
      used = h;
    } else {
      cur.push(id);
      used += h;
    }
  }
  const pages = book.length;
  page = Math.min(page, pages - 1);
  c.label(8, c.top + 1, t('craft.title'), C.gold);
  c.label(192, c.top + 1, t('bag.gold', { gold: fmt(s.money) }), C.gold, 1, 'right');
  let y = c.top + 14;
  for (const id of book[page]!) {
    y = c.row(y, rowSpec(id, c));
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
      t('craft.fiber', { n: countItem(s, 'fiber') }),
      C.creamDim,
      1,
      'left',
      184,
    );
  }
}

/** One recipe's row. Without a tab context (packing pages by height) the buttons do nothing. */
function rowSpec(id: string, c?: MenuTabContext): RowSpec {
  const s = getState();
  const r = recipes[id]!;
  const unlocked = isRecipeUnlocked(s, r);
  const need = recipeNeedLine(s, r);
  const block = craftBlock(s, id);
  const batch = plainBatch(s, id, 5);
  return {
    icon: items[r.output.item]?.icon,
    title: `${r.name}${r.output.qty > 1 ? ` x${r.output.qty}` : ''}`,
    sub: unlocked ? need : lockedText(s, r),
    subColor: !unlocked ? C.warn : block === 'no_items' || block === 'no_gold' ? C.red : C.creamDim,
    buttons: [
      // Make is always the outermost button, on every row (critique 10: the same column means the same thing).
      {
        label: t('craft.make'),
        width: 38,
        enabled: block === null,
        color: block === null ? C.green : C.creamDim,
        onClick: () => {
          if (craft(getState(), id) === 'ok') audio.play('buy');
          else audio.play('error');
          c?.rebuild();
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
                c?.rebuild();
              },
            },
          ]
        : []),
    ],
  };
}
