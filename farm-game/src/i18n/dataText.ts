/**
 * Game data in other languages, without forking the data. `src/data/*.json` stays the English source of truth;
 * a locale's overlay (`src/i18n/data/<locale>/<file>.json`) maps each English string of that file to its
 * translation: `{ "Turnip": "Nabo" }`. On a language change the text fields listed in `TEXT_FIELDS` are rewritten
 * in place from an English snapshot, so every reader of `items[id].name`, a villager's lines or a letter sees the
 * current language with no change of its own. A string with no translation stays English (tests/i18n.test.ts
 * lists those, so both languages stay complete).
 *
 * Keyed by the English text rather than by a path: adding an item is still one data edit (plus its translation),
 * reordering lines never mismatches them, and an edited English line shows up as untranslated instead of
 * silently keeping the old translation.
 */
import * as data from '../data';
import { getLocale, LOCALES, onLocaleChange, rememberEnglish, type Locale } from './index';

/** Per data file: the keys whose string values (or arrays of strings) are player-visible text. */
export const TEXT_FIELDS: Record<string, readonly string[]> = {
  animals: ['name'],
  cart: ['use', 'tag'],
  collections: ['name'],
  festivals: ['name', 'blurb'],
  game: ['title', 'text'],
  goals: ['text', 'hint'],
  guide: ['title', 'paras'],
  items: ['name', 'description', 'nameTemplate', 'source'],
  jobs: ['text'],
  mail: ['title', 'text'],
  nodes: ['name'],
  npcs: ['name', 'blurb', 'stranger', 'text', 'friend', 'close', 'rain', 'title', 'lines'],
  placeables: ['name'],
  plots: ['name'],
  projects: ['name', 'blurb', 'reward'],
  recipes: ['name'],
  reveal: ['note'],
  shops: ['name', 'label'],
  skills: ['name', 'blurb'],
  tips: ['text'],
  trees: ['name'],
  // refusal hints are keyed by the English refusal itself ("Till the soil first." -> a hint): see REFUSAL_MAPS
  tutorial: ['welcome', 'text', 'elseText'],
  valley: [
    'title',
    'text',
    'sign',
    'note',
    'banner',
    'name',
    'asked',
    'lines',
    'phrase',
    'deltaText',
    // valley.houses: what a house's door says (M7)
    'boarded',
    'built',
    'home',
    // valley.planned: id -> name of a place not built yet
    'forge',
    'weir',
    'seedhouse',
    'orchard',
    'market',
  ],
};

/** Objects whose keys are English refusals and whose values are text (`tutorial.refusals`, a step's `refusals`). */
const REFUSAL_MAPS = new Set(['refusals']);

/** The data roots by file name (the exports of src/data/index.ts). */
export const DATA_ROOTS: Record<string, unknown> = {
  animals: data.animals,
  cart: data.cart,
  collections: data.collections,
  festivals: data.festivals,
  game: data.game,
  goals: data.goals,
  guide: data.guide,
  items: data.items,
  jobs: data.jobs,
  mail: data.mail,
  maps: data.mapsData,
  nodes: data.nodes,
  npcs: data.npcs,
  placeables: data.placeables,
  plots: data.plots,
  projects: data.projects,
  recipes: data.recipes,
  reveal: data.reveal,
  shops: data.shops,
  skills: data.skills,
  tips: data.tips,
  trees: data.trees,
  tutorial: data.tutorial,
  valley: data.valley,
};

export type Overlay = Record<string, string>;
const overlayFiles = import.meta.glob<{ default: Overlay }>('./data/*/*.json', { eager: true });

/** A locale's overlay for one data file (empty for English or a file with none). */
export function overlayFor(locale: Locale, file: string): Overlay {
  return overlayFiles[`./data/${locale}/${file}.json`]?.default ?? {};
}

type Visit = (english: string, set: (s: string) => void) => void;

/** Walk every text string of one data file: `english` from the snapshot, `set` writes the live object. */
function walkText(file: string, english: unknown, live: unknown, visit: Visit): void {
  const fields = new Set(TEXT_FIELDS[file] ?? []);
  const walk = (en: unknown, target: unknown, isText: boolean, inRefusals: boolean): void => {
    if (Array.isArray(en)) {
      const arr = target as unknown[];
      en.forEach((v, i) => {
        if (typeof v === 'string') {
          if (isText) visit(v, (s) => (arr[i] = s));
        } else walk(v, arr[i], isText, false);
      });
      return;
    }
    if (!en || typeof en !== 'object') return;
    const obj = target as Record<string, unknown>;
    for (const [k, v] of Object.entries(en as Record<string, unknown>)) {
      const text = inRefusals || fields.has(k);
      if (typeof v === 'string') {
        if (text) visit(v, (s) => (obj[k] = s));
      } else walk(v, obj[k], text, REFUSAL_MAPS.has(k));
    }
  };
  walk(english, live, false, false);
}

/** Every English text string of every data file, with where it is (tests: completeness, fit, glyphs). */
export function dataStrings(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const [file, root] of Object.entries(snapshot()))
    walkText(file, root, structuredClone(root), (text) => out.push({ file, text }));
  return out;
}

/**
 * Text that lives in the generated map files (a locked door's `lockedText`), translated where it is read: the
 * overlay file `maps.json` is keyed by the English text like the others.
 */
export function mapText(englishText: string): string {
  const out = overlayFor(getLocale(), 'maps')[englishText] ?? englishText;
  rememberEnglish(out, englishText);
  return out;
}

/** Every overlay of a locale merged (English -> translation), and the way back, built on first use. */
const merged = new Map<Locale, { to: Map<string, string>; back: Map<string, string> }>();
function mergedFor(locale: Locale): { to: Map<string, string>; back: Map<string, string> } {
  let m = merged.get(locale);
  if (!m) {
    m = { to: new Map(), back: new Map() };
    for (const [path, mod] of Object.entries(overlayFiles))
      if (path.startsWith(`./data/${locale}/`))
        for (const [en, tr] of Object.entries(mod.default)) {
          m.to.set(en, tr);
          m.back.set(tr, en);
        }
    merged.set(locale, m);
  }
  return m;
}

/**
 * A data string kept in the save (a letter's title or text, written in the language of the day it came) in the
 * current language: whichever language it was stored in, a known data string is shown in today's.
 */
export function relocalize(text: string): string {
  const whole = relocalizeKnown(text);
  if (whole !== null) return whole;
  // a data string with a word after it, kept as one (Rosa's letter and her signature, mechanics/valley.ts)
  const cut = text.lastIndexOf(' ');
  const head = cut > 0 ? relocalizeKnown(text.slice(0, cut)) : null;
  return head === null ? text : `${head} ${relocalize(text.slice(cut + 1))}`;
}

/** `relocalize` for a whole known data string (English or a translation); null when no overlay knows it. */
function relocalizeKnown(text: string): string | null {
  let en: string | null = null;
  for (const l of LOCALES) {
    if (l === 'en') continue;
    const m = mergedFor(l);
    const back = m.back.get(text);
    if (back !== undefined) {
      en = back;
      break;
    }
    if (m.to.has(text)) en = text;
  }
  if (en === null) return null;
  const now = getLocale();
  return now === 'en' ? en : (mergedFor(now).to.get(en) ?? en);
}

let english: Record<string, unknown> | null = null;
/** The English data, copied before the first translation (later switches start from it). */
function snapshot(): Record<string, unknown> {
  english ??= Object.fromEntries(
    Object.entries(DATA_ROOTS).map(([file, root]) => [file, structuredClone(root)]),
  );
  return english;
}

/** Rewrite every data text field in `locale` (English restores the source). */
export function applyDataLocale(locale: Locale): void {
  const en = snapshot();
  for (const [file, root] of Object.entries(DATA_ROOTS)) {
    const overlay = overlayFor(locale, file);
    walkText(file, en[file], root, (src, set) => {
      const out = locale === 'en' ? src : (overlay[src] ?? src);
      set(out);
      rememberEnglish(out, src);
    });
  }
}

let installed = false;
/** Keep the data in the current language from now on (called once at boot, before anything draws). */
export function installDataText(): void {
  if (installed) return;
  installed = true;
  if (getLocale() !== 'en') applyDataLocale(getLocale());
  onLocaleChange(applyDataLocale);
}
