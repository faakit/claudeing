import { skills } from '../../data';
import { getState } from '../../state/store';
import { levelOf, levelProgress, maxLevel, perk } from '../../systems/skills';
import { C } from '../theme';
import { drawBar } from '../widgets';
import { fmt } from './format';
import { perkLine } from './perkText';
import type { MenuTabContext } from './MenuPanel';

/** Menu tab: every skill with its level, XP bar and the next perk waiting at the next level. */
export function buildSkills(c: MenuTabContext): void {
  const s = getState();
  let y = c.top + 2;
  for (const [id, def] of Object.entries(skills)) {
    const lvl = levelOf(s, id);
    const prog = levelProgress(s, id);
    c.label(8, y, def.name.toUpperCase(), C.gold);
    c.label(192, y, `Lv ${lvl}${lvl >= maxLevel(id) ? ' MAX' : ''}`, C.cream, 1, 'right');
    const g = c.scene.add.graphics();
    drawBar(g, 8, y + 12, 184, 6, prog ? prog.have / prog.need : 1, C.green);
    c.add(g);
    if (prog) c.label(8, y + 21, `${fmt(prog.have)}/${fmt(prog.need)} XP`, C.creamDim);
    const next = Object.entries(def.perks)
      .map(([l, p]) => [Number(l), p] as const)
      .filter(([l]) => l > lvl)
      .sort((a, b) => a[0] - b[0])[0];
    c.label(
      8,
      y + 33,
      next ? `Lv ${next[0]}: ${perkLine(next[1])}` : 'All perks unlocked!',
      next ? C.green : C.creamDim,
      1,
      'left',
      184,
    );
    y += 54;
  }
  const bonus = perk(s, 'maxEnergy');
  c.label(
    8,
    c.bottom - 22,
    `Skills give you ${bonus} extra energy so far.`,
    C.creamDim,
    1,
    'left',
    184,
  );
}
