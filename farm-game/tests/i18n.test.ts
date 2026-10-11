/**
 * Text and translations (src/i18n): the dictionaries stay in step, the data overlays are complete, the pixel font
 * can draw every Portuguese string, Portuguese text still fits where English is measured, and no new hard-coded
 * player-visible string lands in game code (tests/i18nScan.ts).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  detectLocale,
  dictionary,
  fmtGold,
  fmtNum,
  getLocale,
  interpolate,
  LOCALES,
  parseLocale,
  setLocale,
  t,
  tEn,
  toEnglish,
  type Dict,
  type Key,
} from '../src/i18n';
import { applyDataLocale, dataStrings, overlayFor, relocalize } from '../src/i18n/dataText';
import { game, goals, items, tips, tutorial, valley } from '../src/data';
import { hasGlyph, measureText, wrapText } from '../src/ui/fontMetrics';
import { scanSource } from './i18nScan';

afterEach(() => setLocale('en'));

type Leaf = string | Record<string, string>;
function leaves(d: Dict, prefix = ''): Map<string, Leaf> {
  const out = new Map<string, Leaf>();
  for (const [k, v] of Object.entries(d)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else if (typeof v['other'] === 'string' && Object.values(v).every((x) => typeof x === 'string'))
      out.set(key, v as Record<string, string>);
    else for (const [k2, v2] of leaves(v, key)) out.set(k2, v2);
  }
  return out;
}
const forms = (v: Leaf): string[] => (typeof v === 'string' ? [v] : Object.values(v));
const params = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
const paramSet = (v: Leaf): string[] => [...new Set(forms(v).flatMap(params))].sort();
/** Characters the font cannot draw (params aside). */
const undrawable = (s: string): string[] =>
  [...s.replace(/\{\w+\}/g, '')].filter((ch) => !hasGlyph(ch));

describe('i18n core', () => {
  it('fills params, keeps an unknown one visible, and picks plural forms by count', () => {
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(t('bees.honeyIn', { count: 1, flowers: '' })).toBe('Honey in 1 day.');
    expect(t('bees.honeyIn', { count: 3, flowers: '' })).toBe('Honey in 3 days.');
    setLocale('pt-BR');
    expect(t('bees.honeyIn', { count: 1, flowers: '' })).toBe('Mel em 1 dia.');
    expect(t('bees.honeyIn', { count: 3, flowers: '' })).toBe('Mel em 3 dias.');
  });

  it('falls back to English for a key a locale lacks, and to the key itself; never throws', () => {
    setLocale('pt-BR');
    expect(t('no.such.key' as Key)).toBe('no.such.key');
    const pt = dictionary('pt-BR') as Record<string, Dict>;
    const saved = pt['common']!['close'];
    delete pt['common']!['close'];
    try {
      expect(t('common.close')).toBe('Close');
    } finally {
      pt['common']!['close'] = saved!;
    }
  });

  it('formats numbers and gold the way each language writes them', () => {
    expect(fmtNum(1234)).toBe('1,234');
    expect(fmtGold(1234)).toBe('1,234g');
    setLocale('pt-BR');
    expect(fmtNum(1234)).toBe('1.234');
    expect(fmtGold(1234)).toBe('1.234o');
  });

  it('reads the device language: any Portuguese is pt-BR, anything else English', () => {
    expect(detectLocale(['pt-PT', 'en'])).toBe('pt-BR');
    expect(detectLocale(['pt'])).toBe('pt-BR');
    expect(detectLocale(['fr-FR', 'pt-BR'])).toBe('pt-BR');
    expect(detectLocale(['en-GB', 'pt-BR'])).toBe('en');
    expect(detectLocale(['de'])).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
    expect(parseLocale('pt-br')).toBe('pt-BR');
    expect(parseLocale('EN')).toBe('en');
    expect(parseLocale('xx')).toBeNull();
    expect(parseLocale(null)).toBeNull();
  });

  it('maps shown text back to English, for patterns over English labels', () => {
    setLocale('pt-BR');
    const label = t('mail.read');
    expect(label).toBe('Ler');
    expect(toEnglish(label)).toBe('Read');
    expect(toEnglish(t('bag.eat', { n: 30 }))).toBe('Eat +30');
    expect(toEnglish(items['hoe']!.name)).toBe('Hoe');
    setLocale('en');
    expect(toEnglish('Read')).toBe('Read');
  });

  it('switching language rewrites the data and switching back restores it', () => {
    expect(items['hoe']!.name).toBe('Hoe');
    setLocale('pt-BR');
    applyDataLocale('pt-BR');
    expect(items['hoe']!.name).toBe('Enxada');
    expect(valley.letter.sign).toBe('Rosa');
    applyDataLocale('en');
    expect(items['hoe']!.name).toBe('Hoe');
  });

  it('a letter kept in the save shows in the language of the day', () => {
    const en = 'Your first harvest!';
    const pt = overlayFor('pt-BR', 'mail')[en]!;
    expect(relocalize(en)).toBe(en);
    expect(relocalize(pt)).toBe(en);
    setLocale('pt-BR');
    expect(relocalize(en)).toBe(pt);
    expect(relocalize('A line no data has.')).toBe('A line no data has.');
  });
});

describe('dictionaries', () => {
  const en = leaves(dictionary('en'));

  it('every locale has exactly the English keys, with the same {params}', () => {
    for (const locale of LOCALES) {
      const other = leaves(dictionary(locale));
      expect([...other.keys()].filter((k) => !en.has(k)), `${locale}: keys English lacks`).toEqual([]);
      expect([...en.keys()].filter((k) => !other.has(k)), `${locale}: missing keys`).toEqual([]);
      for (const [k, v] of other) {
        // a translation may drop an English-only param (`{s}`, the plural s), never invent one
        const extra = paramSet(v).filter((p) => !paramSet(en.get(k)!).includes(p));
        expect(extra, `${locale} ${k}`).toEqual([]);
        expect(forms(v).every((x) => x.trim().length > 0), `${locale} ${k} is empty`).toBe(true);
      }
    }
  });

  it('plural keys give every locale an "other" form', () => {
    for (const locale of LOCALES)
      for (const [k, v] of leaves(dictionary(locale)))
        if (typeof v !== 'string') expect(v['other'], `${locale} ${k}`).toBeTypeOf('string');
  });

  it('the pixel font draws every character of every dictionary string', () => {
    for (const locale of LOCALES)
      for (const [k, v] of leaves(dictionary(locale)))
        for (const s of forms(v)) expect(undrawable(s), `${locale} ${k}: ${s}`).toEqual([]);
  });
});

describe('data overlays', () => {
  const strings = dataStrings();

  it('every English data string has a Portuguese translation, and no translation is stale', () => {
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      const missing = strings.filter((s) => !overlayFor(locale, s.file)[s.text]);
      expect(
        missing.map((s) => `${s.file}: ${s.text}`),
        `${locale}: add these to src/i18n/data/${locale}/<file>.json`,
      ).toEqual([]);
      const files = new Set(strings.map((s) => s.file));
      for (const file of files) {
        const known = new Set(strings.filter((s) => s.file === file).map((s) => s.text));
        const stale = Object.keys(overlayFor(locale, file)).filter((k) => !known.has(k));
        expect(stale, `${locale}/${file}.json: English no data file has (edited or removed?)`).toEqual(
          [],
        );
      }
    }
  });

  it('translations keep the {params}; the font draws every character', () => {
    for (const locale of LOCALES.filter((l) => l !== 'en'))
      for (const { file, text } of strings) {
        const tr = overlayFor(locale, file)[text];
        if (!tr) continue;
        const want = [...new Set(params(text))].sort();
        // jobs.json texts may add the plural `{s}` their English does not need ("catch {n} fish")
        const got = [...new Set(params(tr))].filter((p) => !(file === 'jobs' && p === 's')).sort();
        expect(got, `${locale} ${file}: ${tr}`).toEqual(want);
        expect(undrawable(tr), `${locale} ${file}: ${tr}`).toEqual([]);
      }
  });
});

describe('Portuguese fits where English is measured', () => {
  const inPt = (fn: () => void) => {
    setLocale('pt-BR');
    applyDataLocale('pt-BR');
    try {
      fn();
    } finally {
      applyDataLocale('en');
      setLocale('en');
    }
  };

  it('goals fit the goal plate and their hints two sheet rows', () =>
    inPt(() => {
      for (const g of goals) {
        expect(measureText(g.text), g.text).toBeLessThanOrEqual(182);
        expect(measureText(t('ui.hint', { hint: g.hint })), g.hint).toBeLessThanOrEqual(184 * 2 - 24);
      }
      for (const tip of tips) expect(measureText(tip.text), tip.text).toBeLessThanOrEqual(186 * 3 - 30);
    }));

  it("every coach line fits one row and Rosa's welcome two", async () => {
    const { allLines, COACH_LINE_PX, WELCOME_PX, welcome } = await import(
      '../src/systems/tutorial'
    );
    inPt(() => {
      for (const l of allLines()) expect(measureText(l), l).toBeLessThanOrEqual(COACH_LINE_PX);
      expect(measureText(welcome().text)).toBeLessThanOrEqual(WELCOME_PX * 2 - 20);
      expect(wrapText(tutorial.welcome, WELCOME_PX).length).toBeLessThanOrEqual(2);
    });
  });

  it("Rosa's letter fits the title card above New Game", async () => {
    const { letterLayout, LETTER_CARD, TITLE_BUTTON_H } = await import('../src/ui/titleLetter');
    inPt(() => {
      const L = letterLayout();
      expect(L.rows.length).toBeLessThanOrEqual(10);
      for (const r of L.rows) expect(measureText(r), r).toBeLessThanOrEqual(LETTER_CARD.w - 16);
      expect(L.buttonY + TITLE_BUTTON_H).toBeLessThanOrEqual(340);
    });
  });

  it('the valley banners fit their two-line slot (title at 2x)', () =>
    inPt(() => {
      for (const [title, line] of [
        valley.farmGreen.banner.split('\n'),
        [t('valley.creekTitle'), t('valley.creekLine')],
      ]) {
        expect(measureText(title!, 2), title).toBeLessThanOrEqual(190);
        expect(measureText(line!), line).toBeLessThanOrEqual(190);
      }
    }));

  it('Options and title buttons keep their labels inside the button', () =>
    inPt(() => {
      const half = 92 - 8;
      for (const label of [
        t('opts.language', { lang: t('lang.short') }),
        t('opts.saveNow'),
        t('opts.saved'),
        t('opts.saveFailed'),
        t('opts.tapAgain'),
        t('opts.quitAnyway'),
        t('opts.quit'),
        t('opts.leftHand', { state: t('common.off') }),
        t('opts.fullscreen'),
        t('opts.vibrate', { state: t('common.off') }),
        t('opts.controls'),
        t('opts.sound', { state: t('common.off') }),
        t('opts.calm', { state: t('common.off') }),
      ])
        expect(measureText(label), label).toBeLessThanOrEqual(half);
      for (const note of [t('opts.autosave1'), t('opts.autosave2')])
        expect(measureText(note), note).toBeLessThanOrEqual(90);
      expect(measureText(t('lang.name'))).toBeLessThanOrEqual(58 - 8);
      for (const label of [t('title.continue'), t('title.newGame'), t('title.eraseConfirm')])
        expect(measureText(label), label).toBeLessThanOrEqual(150 - 8);
      expect(measureText(t('sleep.title'), 2)).toBeLessThanOrEqual(184);
      expect(measureText(t('yearEnd.title'), 2)).toBeLessThanOrEqual(184);
      expect(measureText(t('opts.music'))).toBeLessThanOrEqual(36);
    }));

  it('single-line texts of the title, the morning summary and the year end fit the sheet', () =>
    inPt(() => {
      expect(measureText(t('title.subtitle'))).toBeLessThanOrEqual(196);
      for (const k of [
        'summary.storm',
        'summary.rain',
        'summary.sun',
        'summary.passedOut',
        'summary.slept',
        'yearEnd.newSpring',
        'fishing.keepGreen',
        'fishing.waiting',
        'ui.lateWarning',
      ] as const)
        expect(measureText(t(k)), k).toBeLessThanOrEqual(184);
      for (const r of game.ranks)
        expect(measureText(r.title.toUpperCase(), 2), r.title).toBeLessThanOrEqual(190);
    }));

  it('the HUD date and weather lines fit their boxes', () =>
    inPt(() => {
      for (const season of ['spring', 'summer', 'fall', 'winter'] as const)
        expect(
          measureText(t('hud.date', { season: t(`season.${season}` as Key), day: 28, year: 10 })),
        ).toBeLessThanOrEqual(100);
      for (const w of ['hud.storm', 'hud.rainy', 'hud.sunny'] as const)
        expect(measureText(t(w)), w).toBeLessThanOrEqual(60);
    }));
});

describe('no hard-coded player-visible strings', () => {
  /** Where player-visible text is drawn or composed. Dev tools, data validation and the art and audio pipelines
   * say nothing to the player. */
  const ROOTS = [
    'src/ui',
    'src/scenes',
    'src/systems',
    'src/mechanics',
    'src/fx',
    'src/game',
    'src/input',
    'src/platform',
  ];
  /** Device profiles for the reach maths (tests only, never drawn). */
  const SKIP_FILES = new Set(['src/ui/reach.ts']);
  /** Scene keys: identifiers that happen to be capitalised words. */
  const ALLOWED = new Set([
    'Boot',
    'Preload',
    'Title',
    'UI',
    'Farm',
    'House',
    'Town',
    'Woods',
    'Mine',
    'Wendhead',
  ]);

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return files(p);
      return name.endsWith('.ts') ? [p.replace(/\\/g, '/')] : [];
    });
  }

  it('finds prose and leaves keys, ids and marked lines alone', () => {
    const src = [
      "label('Close');",
      "t('common.close');",
      "emit('openPanel', { type: 'bag' });",
      "const s = `${n} more days`;",
      "if (code === 'Space') go();",
      "toast('Nope.'); // i18n-ok",
      "import x from './Some Thing';",
    ].join('\n');
    expect(scanSource(src).map((f) => f.text)).toEqual(['Close', '{} more days']);
  });

  it('game code draws text only through the dictionaries', { timeout: 60_000 }, () => {
    const found: string[] = [];
    for (const root of ROOTS)
      for (const f of files(root)) {
        if (SKIP_FILES.has(f)) continue;
        for (const hit of scanSource(readFileSync(f, 'utf8'), f))
          if (!ALLOWED.has(hit.text)) found.push(`${f}:${hit.line} ${JSON.stringify(hit.text)}`);
      }
    expect(
      found,
      'Move these to src/i18n/en.json + pt-BR.json and call t() (mark a never-shown string // i18n-ok)',
    ).toEqual([]);
  });
});

describe('the language at boot', () => {
  it('starts in English (tests and automated browsers rely on it)', () => {
    expect(getLocale()).toBe('en');
    expect(tEn('common.close')).toBe('Close');
  });
});
