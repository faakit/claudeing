/**
 * Morning notes, arranged for a small sheet: news first, the same every-day lines last and folded into one
 * ("Fresh wild goods, ore and requests today."), so a crowded morning cuts routine, never news.
 */
/**
 * The lines a season-change morning is about: the board's result and the special that ended. They come first, so
 * a crowded morning never cuts them (critique 12, F3).
 */
const HEADLINES: RegExp[] = [
  /board last season/,
  /^The board was quiet last season/,
  /^The special order ran out/,
];

const ROUTINE: [RegExp, string][] = [
  [/^Wild goods (are growing|have sprouted)/, 'wild goods'],
  [/^Fresh ore in the mine/, 'ore'],
  [/^New requests on the town board/, 'requests'],
];

export function arrangeNotes(notes: readonly string[]): string[] {
  const headlines: string[] = [];
  const rest: string[] = [];
  const routine: string[] = [];
  for (const n of notes) {
    const hit = ROUTINE.find(([re]) => re.test(n));
    if (hit) routine.push(hit[1]);
    else if (HEADLINES.some((re) => re.test(n))) headlines.push(n);
    else rest.push(n);
  }
  const news = [...headlines, ...rest];
  if (routine.length === 0) return news;
  const list =
    routine.length === 1
      ? routine[0]
      : `${routine.slice(0, -1).join(', ')} and ${routine[routine.length - 1]}`;
  return [...news, `Fresh ${list} today.`];
}
