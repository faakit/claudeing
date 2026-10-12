/**
 * Translations: `t(key, params?)` looks a key up in the current locale's dictionary (`en.json`, `pt-BR.json`),
 * fills `{name}` params and picks a plural form by `params.count` (`Intl.PluralRules`). A key missing from a
 * locale falls back to English, then to the key itself; it never throws. Numbers and gold go through `Intl`.
 *
 * Game data (item names, villagers' lines, letters...) stays English in `src/data/*.json`; `dataText.ts` lays a
 * per-locale overlay over it (docs/EXTENDING.md, "Text and translations"). Pure: no Phaser, no DOM.
 */
import en from './en.json';
import ptBR from './pt-BR.json';

export type Locale = 'en' | 'pt-BR';
/** Every supported locale, in the order the language switch steps through them. */
export const LOCALES: readonly Locale[] = ['en', 'pt-BR'];

/** A dictionary: nested namespaces of strings; a leaf may be plural forms (`{ "one": .., "other": .. }`). */
export interface Dict {
  [key: string]: string | Dict;
}
type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Dotted paths to every leaf of the English dictionary: `t()` keys are checked at compile time. */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends { other: string }
      ? `${P}${K}`
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type Key = Leaves<typeof en>;
export type Params = Record<string, string | number>;

const DICTS: Record<Locale, Dict> = { en: en as Dict, 'pt-BR': ptBR as Dict };

let locale: Locale = 'en';
const listeners = new Set<(l: Locale) => void>();
let plural = new Intl.PluralRules('en');
let numbers = new Intl.NumberFormat('en-US');
/** Keys looked up but missing in the current locale (dev builds warn once each). */
const missing = new Set<string>();

export const getLocale = (): Locale => locale;

/** Switch the language. Listeners run (the data overlay, the UI rebuild) only when it changes. */
export function setLocale(next: Locale): void {
  if (!LOCALES.includes(next) || next === locale) return;
  locale = next;
  plural = new Intl.PluralRules(next);
  numbers = new Intl.NumberFormat(next === 'en' ? 'en-US' : next);
  reverse.clear();
  dataReverse.clear();
  for (const fn of listeners) fn(next);
}

/** Called after every language change. Returns an unsubscribe function. */
export function onLocaleChange(fn: (l: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The locale a device asks for: any Portuguese (`pt`, `pt-BR`, `pt-PT`) gives Brazilian Portuguese, anything
 * else English. The first language the browser lists that we support wins.
 */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  for (const raw of languages ?? []) {
    const l = raw.toLowerCase();
    if (l.startsWith('pt')) return 'pt-BR';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

/**
 * The language a device starts in before any stored choice: an automated browser (`navigator.webdriver`) reads
 * English whatever the machine is set to, so checks see the same text; anyone else gets `detectLocale`.
 */
export function deviceLocale(
  nav: { webdriver?: boolean; languages?: readonly string[]; language?: string } | undefined,
): Locale {
  return nav?.webdriver ? 'en' : detectLocale(nav?.languages ?? [nav?.language ?? 'en']);
}

/** A `?lang=` value or a stored choice, if it names a supported locale (case-insensitive, `pt` = pt-BR). */
export function parseLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  const l = raw.trim().toLowerCase();
  if (l === 'en' || l.startsWith('en-')) return 'en';
  if (l === 'pt' || l.startsWith('pt-')) return 'pt-BR';
  return null;
}

function lookup(dict: Dict, key: string): string | Dict | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return node;
}

const isPlural = (v: string | Dict | undefined): v is PluralForms =>
  typeof v === 'object' && typeof v['other'] === 'string';

function pick(v: string | Dict | undefined, count: unknown, rules: Intl.PluralRules): string | null {
  if (typeof v === 'string') return v;
  if (!isPlural(v)) return null;
  const form = typeof count === 'number' ? rules.select(count) : 'other';
  return v[form] ?? v.other;
}

/** Fill `{name}` params; an unknown param stays as written, so a typo shows instead of vanishing. */
export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    params[name] === undefined ? m : String(params[name]),
  );
}

const englishRules = new Intl.PluralRules('en');

/** The English text of a key (whatever the locale): the fallback, and what tests and checks compare. */
export function tEn(key: Key | string, params?: Params): string {
  return interpolate(pick(lookup(DICTS.en, key), params?.['count'], englishRules) ?? key, params);
}

/**
 * Translate a key. `params.count` (a number) picks the plural form and also fills `{count}`. A key missing in
 * this locale uses English; one missing everywhere shows the key itself.
 */
export function t(key: Key, params?: Params): string {
  if (locale === 'en') return tEn(key, params);
  const own = pick(lookup(DICTS[locale], key), params?.['count'], plural);
  if (own === null) {
    noteMissing(key);
    return tEn(key, params);
  }
  const out = interpolate(own, params);
  remember(out, key, params);
  return out;
}

function noteMissing(key: string): void {
  if (missing.has(key)) return;
  missing.add(key);
  if (import.meta.env?.DEV) console.warn(`[i18n] missing ${locale} text: ${key}`);
}

/** Keys the current session looked up and found missing in its locale (dev and tests). */
export const missingKeys = (): string[] => [...missing];

// ---------------------------------------------------------------- numbers

/** A whole number in the locale's style: 1,234 (en) or 1.234 (pt-BR). */
export const fmtNum = (n: number): string => numbers.format(n);

/** An amount of gold: "1,234g" (en), "1.234o" (pt-BR, for ouro). */
export const fmtGold = (n: number): string => goldText(fmtNum(n));
/** A number already written ("12k") with the gold mark. */
export const goldText = (amount: string): string => t('fmt.gold', { n: amount });

// ---------------------------------------------------------------- back to English

/**
 * Rendered text (in the current locale) -> the same text in English, for the few places that match on English
 * labels (the guided start points at a sheet button by a pattern such as `^Read$`). Filled by `t()` and by the data
 * overlay (`rememberEnglish`); bounded, cleared on every language change.
 */
const reverse = new Map<string, () => string>();
/** Translated data strings -> their English source (the overlay fills it on every switch; never trimmed). */
const dataReverse = new Map<string, string>();
const REVERSE_MAX = 2000;
function remember(out: string, key: string, params?: Params): void {
  if (reverse.size > REVERSE_MAX) reverse.clear();
  if (!reverse.has(out)) reverse.set(out, () => tEn(key, params));
}
/** The data overlay registers each translated data string with its English source. */
export function rememberEnglish(out: string, english: string): void {
  if (locale !== 'en' && out !== english && !dataReverse.has(out)) dataReverse.set(out, english);
}

/** The English of a string shown on screen; itself when it is English already or unknown. */
export function toEnglish(text: string): string {
  if (locale === 'en') return text;
  const data = dataReverse.get(text);
  if (data !== undefined) return data;
  const fn = reverse.get(text);
  return fn ? fn() : text;
}

/** A locale's whole dictionary (the key tests compare locales with it). */
export const dictionary = (l: Locale): Dict => DICTS[l];
