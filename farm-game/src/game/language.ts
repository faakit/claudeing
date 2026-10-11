import {
  detectLocale,
  getLocale,
  LOCALES,
  parseLocale,
  setLocale,
  type Locale,
} from '../i18n';
import { installDataText } from '../i18n/dataText';
import { saveStore } from './persistence';

/**
 * The language: settings, not game state, so it lives under its own key in the save store (IndexedDB on the web,
 * the native key-value store in the apps) and never touches the save or its version.
 *
 * At boot: `?lang=pt-BR` (or `en`) wins; else the stored choice; else the device (`pt*` -> pt-BR, anything else
 * English). An automated browser (`navigator.webdriver`) starts in English, so checks that read English text
 * stay stable on a machine set to Portuguese.
 */
export const LANG_KEY = 'lang';

const params = (): URLSearchParams => new URLSearchParams(globalThis.location?.search ?? '');
/** A scenario page is a sandbox: a language picked there is not remembered (like its saves). */
const sandbox = (): boolean => params().has('scenario');

/** Set the boot language now; the stored choice (an async read) follows within a few ms. */
export function initLanguage(): Promise<void> {
  installDataText();
  const forced = parseLocale(params().get('lang'));
  if (forced) {
    setLocale(forced);
    return Promise.resolve();
  }
  const nav = globalThis.navigator as Navigator | undefined;
  setLocale(nav?.webdriver ? 'en' : detectLocale(nav?.languages ?? [nav?.language ?? 'en']));
  return saveStore
    .read(LANG_KEY)
    .then((stored) => {
      const l = parseLocale(stored);
      if (l) setLocale(l);
    })
    .catch(() => undefined);
}

/** The player picked a language (Menu > Opts, or the title): switch now and remember it. */
export function chooseLanguage(l: Locale): void {
  setLocale(l);
  if (!sandbox()) void saveStore.write(LANG_KEY, l).catch(() => undefined);
}

/** The next language in the switch's cycle (two today: English and Portuguese). */
export function nextLanguage(): Locale {
  return LOCALES[(LOCALES.indexOf(getLocale()) + 1) % LOCALES.length]!;
}
