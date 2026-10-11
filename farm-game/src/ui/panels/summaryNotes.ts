import { t, toEnglish, type Key } from '../../i18n';

/**
 * Morning notes, arranged for a small sheet: news first, the same every-day lines last and folded into one
 * ("Fresh wild goods, ore and requests today."), so a crowded morning cuts routine, never news.
 */
/**
 * The lines a season-change morning is about: the board's result and the special that ended. They come first, so
 * a crowded morning never cuts them (critique 12, F3).
 */
const HEADLINES: RegExp[] = [
  /^The farm looks greener this morning/, // the first green (valley.json farmGreen.note)
  /board last season/,
  /^The board was quiet last season/,
  /^The special order ran out/,
];

/** Every-day lines (matched on their English) and the word each folds into ("Fresh ore and requests today."). */
const ROUTINE: [RegExp, Key][] = [
  [/^Wild goods (are growing|have sprouted)/, 'notes.wild'],
  [/^Fresh ore in the mine/, 'notes.ore'],
  [/^New requests on the town board/, 'notes.requests'],
];

export function arrangeNotes(notes: readonly string[]): string[] {
  const headlines: string[] = [];
  const rest: string[] = [];
  const routine: string[] = [];
  for (const n of notes) {
    // notes are in the player's language; they are sorted by their English
    const en = toEnglish(n);
    const hit = ROUTINE.find(([re]) => re.test(en));
    if (hit) routine.push(t(hit[1]));
    else if (HEADLINES.some((re) => re.test(en))) headlines.push(n);
    else rest.push(n);
  }
  const news = [...headlines, ...rest];
  if (routine.length === 0) return news;
  const list =
    routine.length === 1
      ? routine[0]
      : `${routine.slice(0, -1).join(', ')}${t('common.and')}${routine[routine.length - 1]}`;
  return [...news, t('notes.fresh', { list: list ?? '' })];
}
