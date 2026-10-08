/**
 * Morning notes, arranged for a small sheet: news first, the same every-day lines last and folded into one
 * ("Fresh wild goods, ore and requests today."), so a crowded morning cuts routine, never news.
 */
const ROUTINE: [RegExp, string][] = [
  [/^Wild goods (are growing|have sprouted)/, 'wild goods'],
  [/^Fresh ore in the mine/, 'ore'],
  [/^New requests on the town board/, 'requests'],
];

export function arrangeNotes(notes: readonly string[]): string[] {
  const news: string[] = [];
  const routine: string[] = [];
  for (const n of notes) {
    const hit = ROUTINE.find(([re]) => re.test(n));
    if (hit) routine.push(hit[1]);
    else news.push(n);
  }
  if (routine.length === 0) return news;
  const list =
    routine.length === 1
      ? routine[0]
      : `${routine.slice(0, -1).join(', ')} and ${routine[routine.length - 1]}`;
  return [...news, `Fresh ${list} today.`];
}
