// Summarise reach.json and bench*.json into the tables used by PLAN-CONTROLS.md (prints markdown).
//   node agents/out/controls/tools/analyze.mjs > agents/out/controls/tables.md
import { existsSync, readFileSync } from 'node:fs';
import { OUT } from './lib.mjs';

const reach = JSON.parse(readFileSync(`${OUT}reach.json`, 'utf8'));
const md = [];
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');

md.push('## Reach: share of touch targets in each zone (all screens)\n');
md.push(
  '| profile | hand | targets | comfortable | stretch | hard | Action | Interact | Menu | hotbar slots comfortable |',
);
md.push('|---|---|---|---|---|---|---|---|---|---|');
for (const [id, p] of Object.entries(reach.profiles))
  for (const [hand, h] of Object.entries(p.hands)) {
    const all = Object.values(h.screens).flat();
    const n = (z) => all.filter((t) => t.zone === z).length;
    const d = h.screens.dock;
    const z = (name) => {
      const t = d.find((x) => x.text === name);
      return t ? `${t.zone} (${t.dMm} mm)` : '-';
    };
    const slots = d.filter((t) => t.text.startsWith('slot'));
    md.push(
      `| ${id} | ${hand} | ${all.length} | ${pct(n('comfort'), all.length)} | ${pct(n('stretch'), all.length)} | ${pct(n('hard'), all.length)} | ${z('ACTION')} | ${z('INTERACT')} | ${z('MENU')} | ${slots
        .filter((t) => t.zone === 'comfort')
        .map((t) => t.text.slice(5))
        .join(',')} |`,
    );
  }

md.push('\n## Reach per screen (iPhone 13/14): targets outside the comfortable zone\n');
for (const hand of ['right', 'left']) {
  md.push(`\n### ${hand} thumb\n`);
  md.push('| screen | outside comfort / all | which (zone) |');
  md.push('|---|---|---|');
  for (const [screen, ts] of Object.entries(reach.profiles.i13.hands[hand].screens)) {
    const out = ts.filter((t) => t.zone !== 'comfort');
    const names = out
      .map((t) => `${t.text.replace(/\|/g, '/').slice(0, 18)} (${t.zone[0]})`)
      .slice(0, 14)
      .join(', ');
    md.push(
      `| ${screen} | ${out.length}/${ts.length} | ${names}${out.length > 14 ? ', ...' : ''} |`,
    );
  }
}

md.push('\n## Smallest touch target per profile (CSS px; 44 is the house rule)\n');
md.push('| profile | smallest w | smallest h | which |');
md.push('|---|---|---|---|');
for (const [id, p] of Object.entries(reach.profiles)) {
  const all = Object.values(p.hands.right.screens).flat();
  const min = all.reduce((a, t) => (Math.min(t.wCss, t.hCss) < Math.min(a.wCss, a.hCss) ? t : a));
  md.push(`| ${id} | ${min.wCss} | ${min.hCss} | ${min.text.slice(0, 24)} |`);
}

for (const file of ['bench.json', 'bench-reaction180.json', 'bench-human.json']) {
  if (!existsSync(`${OUT}${file}`)) continue;
  const rows = JSON.parse(readFileSync(`${OUT}${file}`, 'utf8'));
  md.push(`\n## Task costs (${file})\n`);
  md.push(
    '| profile | hand | reaction ms | task | taps | holds | drags | gestures | corrections | thumb travel mm (air) | touches outside comfort | ok |',
  );
  md.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const out = r.touchZones.stretch + r.touchZones.hard;
    md.push(
      `| ${r.profile} | ${r.hand} | ${r.reactionMs} | ${r.task} | ${r.taps} | ${r.holds} | ${r.drags} | ${r.gestures} | ${r.corrections} | ${r.travelMm} (${r.airMm}) | ${out}/${r.gestures} | ${r.detail?.error ? 'ERROR' : 'yes'} |`,
    );
  }
}
console.log(md.join('\n'));
