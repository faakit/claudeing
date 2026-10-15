import { t, toEnglish, type Key } from '../../i18n';

/**
 * Morning notes, arranged for a small sheet (tutorial review: at most four, never "...and N more"): the headline
 * of the morning, the letter, the one new thing, other news, then one board line and one line of every-day goods.
 * A crowded morning cuts from the end, so routine goes first and news last.
 */
export const MAX_NOTES = 4;

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
/** The post ("A new letter in the mailbox."), then a feature's arrival ("New in the Menu: ..."). */
const LETTERS = /^(A new letter|\d+ new letters) in the mailbox/;
const ARRIVALS = /^New in the (Menu|Guide)|^From now on|^Clay races you/;

/** The board's every-day lines fold into one ("New jobs and requests on the board."). */
const BOARD: [RegExp, 'jobs' | 'requests'][] = [
  [/^New requests on the town board/, 'requests'],
  // the settling-in days' double pay ("...: double pay while you settle in.") stays news
  [/^New jobs from [^:]*\.$/, 'jobs'],
];
/** Clay's daily moves on the board sit with the board line, below the news. */
const CLAY = /^Clay /;

/** Every-day goods (matched on their English) and the word each folds into ("Fresh wild goods and ore today."). */
const ROUTINE: [RegExp, Key][] = [
  [/^Wild goods (are growing|have sprouted)/, 'notes.wild'],
  [/^Fresh ore in the mine/, 'notes.ore'],
];

export function arrangeNotes(notes: readonly string[], max = MAX_NOTES): string[] {
  const rank: string[][] = [[], [], [], [], [], []];
  const board = new Set<'jobs' | 'requests'>();
  const routine: string[] = [];
  for (const n of notes) {
    // notes are in the player's language; they are sorted by their English
    const en = toEnglish(n);
    const b = BOARD.find(([re]) => re.test(en));
    const r = ROUTINE.find(([re]) => re.test(en));
    if (b) board.add(b[1]);
    else if (r) routine.push(t(r[1]));
    else if (HEADLINES.some((re) => re.test(en))) rank[0]!.push(n);
    else if (LETTERS.test(en)) rank[1]!.push(n);
    else if (ARRIVALS.test(en)) rank[2]!.push(n);
    else if (CLAY.test(en)) rank[4]!.push(n);
    else rank[3]!.push(n);
  }
  if (board.size > 0)
    rank[4]!.unshift(
      t(
        board.size === 2
          ? 'notes.boardBoth'
          : board.has('jobs')
            ? 'notes.boardJobs'
            : 'notes.boardRequests',
      ),
    );
  if (routine.length > 0) {
    const list =
      routine.length === 1
        ? routine[0]
        : `${routine.slice(0, -1).join(', ')}${t('common.and')}${routine[routine.length - 1]}`;
    rank[5]!.push(t('notes.fresh', { list: list ?? '' }));
  }
  return rank.flat().slice(0, max);
}
