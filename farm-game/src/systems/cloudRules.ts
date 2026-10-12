/**
 * The cloud-save rules (pure; DECISIONS.md, "Cloud save"). The cloud holds the same JSON as the local save, so
 * everything here reads a save: how far along it is (day, play time), when it was written, and whether it loads.
 *
 * A save is further along than another when it is ahead on the day and not behind on play time, or ahead on play
 * time on the same day. When the day says one thing and play time the other, the saves diverged (two phones
 * played the same farm): that is a conflict, and only the player may choose. Equal progress falls back to the
 * newer write. Nothing here ever lets a further-along save be overwritten without asking.
 */
import { STATE_VERSION, type GameState, type Season } from '../state/GameState';
import { migrate } from './save';
import { absoluteDay } from './time';

/** Seconds played (counted while a game is open and the app is in front). A stat: no save change. */
export const PLAY_STAT = 'playSec';
/** When the save was written (ms since 1970). A stat: no save change. */
export const SAVED_AT_STAT = 'savedAt';

export interface SaveSummary {
  /** Absolute day (1 = the first spring day of year 1). */
  day: number;
  year: number;
  season: Season;
  dayOfSeason: number;
  money: number;
  playSec: number;
  /** ms, 0 when unknown (a save from before cloud save). */
  savedAt: number;
}

export function summarize(s: GameState): SaveSummary {
  return {
    day: absoluteDay(s),
    year: s.time.year,
    season: s.time.season,
    dayOfSeason: s.time.day,
    money: s.money,
    playSec: Math.floor(s.stats[PLAY_STAT] ?? 0),
    savedAt: Math.floor(s.stats[SAVED_AT_STAT] ?? 0),
  };
}

/**
 *  - none      neither side has a save
 *  - same      the same save (same progress, same write)
 *  - local     this phone's save is further along (or only it exists): it may go up
 *  - cloud     the cloud's save is further along (or only it exists)
 *  - conflict  the two diverged: ask
 */
export type Verdict = 'none' | 'same' | 'local' | 'cloud' | 'conflict';

export function compareSaves(local: SaveSummary | null, cloud: SaveSummary | null): Verdict {
  if (!local && !cloud) return 'none';
  if (!cloud) return 'local';
  if (!local) return 'cloud';
  const day = Math.sign(local.day - cloud.day);
  const play = Math.sign(local.playSec - cloud.playSec);
  if (day !== 0 && play !== 0 && day !== play) return 'conflict';
  const ahead = day !== 0 ? day : play;
  if (ahead > 0) return 'local';
  if (ahead < 0) return 'cloud';
  if (local.savedAt === cloud.savedAt) return 'same';
  return local.savedAt > cloud.savedAt ? 'local' : 'cloud';
}

/** A cloud blob, read: a usable save, nothing, unreadable, or from a newer game version (never overwritten). */
export type BlobRead =
  | { kind: 'ok'; state: GameState; summary: SaveSummary }
  | { kind: 'empty' }
  | { kind: 'corrupt' }
  | { kind: 'newer'; version: number };

export function readBlob(text: string | null | undefined): BlobRead {
  if (!text) return { kind: 'empty' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'corrupt' };
  }
  const v = (raw as { version?: unknown } | null)?.version;
  if (typeof v === 'number' && v > STATE_VERSION) return { kind: 'newer', version: v };
  try {
    const state = migrate(raw);
    return { kind: 'ok', state, summary: summarize(state) };
  } catch {
    return { kind: 'corrupt' };
  }
}

/**
 * What a sync does with this phone's save and the cloud's:
 *  - upload   the cloud is empty, unreadable or behind, or the player chose to replace exactly this cloud save
 *             (`approved`: the cloud save's write time, from "Keep this phone's")
 *  - same     nothing to do: the cloud already holds this save
 *  - ask      the cloud is further along or diverged: the player chooses
 *  - blocked  the cloud save is from a newer version of the game
 *
 * Progress only grows (days and play time never go back), so a save that continues the cloud's always compares
 * as further along: no record of the last sync is needed to upload freely from one phone.
 */
export type SyncAction = 'upload' | 'same' | 'ask' | 'blocked';

export function decideSync(
  local: SaveSummary,
  cloud: BlobRead,
  approved: number | null = null,
): { action: SyncAction; verdict: Verdict } {
  if (cloud.kind === 'newer') return { action: 'blocked', verdict: 'cloud' };
  if (cloud.kind !== 'ok') return { action: 'upload', verdict: 'local' };
  const verdict = compareSaves(local, cloud.summary);
  if (verdict === 'same') return { action: 'same', verdict };
  if (verdict === 'local') return { action: 'upload', verdict };
  if (approved !== null && cloud.summary.savedAt === approved) return { action: 'upload', verdict };
  return { action: 'ask', verdict };
}

/** Provider metadata for a save (Play Games' list shows it; its own conflict policy reads `progress`). */
export function progressValue(s: SaveSummary): number {
  return s.day * 1_000_000 + Math.min(999_999, Math.floor(s.playSec / 60));
}
