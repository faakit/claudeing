import { items, recipes, skills } from '../../data';
import { getState } from '../../state/store';
import { craft, craftBlock } from '../../systems/crafting';
import { countItem } from '../../systems/inventory';
import { audio } from '../../platform/audio';
import { isRecipeUnlocked, levelOf } from '../../systems/skills';
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
    const need = r.ingredients
      .map((i) => `${i.qty} ${items[i.item]?.name ?? i.item}`)
      .concat(r.gold ? [`${r.gold}g`] : [])
      .join(', ');
    const block = craftBlock(s, id);
    y = c.row(y, {
      icon: items[r.output.item]?.icon,
      title: `${r.name}${r.output.qty > 1 ? ` x${r.output.qty}` : ''}`,
      sub: unlocked
        ? need
        : `${skills[r.unlock!.skill]?.name} Lv ${r.unlock!.level} (you: ${levelOf(s, r.unlock!.skill)})`,
      subColor: !unlocked
        ? C.warn
        : block === 'no_items' || block === 'no_gold'
          ? C.red
          : C.creamDim,
      buttons: [
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
