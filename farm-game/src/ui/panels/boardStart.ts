import type { GameState } from '../../state/GameState';
import { jobReady, postedJobs } from '../../systems/jobs';
import { absoluteDay } from '../../systems/time';

/** The board's two pages: the day's small jobs and the requests. */
export type BoardPage = 'jobs' | 'requests';

/** Today's jobs (empty when the list is an older day's). */
export const todaysJobs = (s: GameState) => (s.jobs.day === absoluteDay(s) ? s.jobs.list : []);

/** The page the board opens on: the jobs while one waits to be taken or turned in, else the requests. Pure. */
export function boardStartPage(s: GameState): BoardPage {
  return postedJobs(s).length > 0 || todaysJobs(s).some((j) => jobReady(s, j))
    ? 'jobs'
    : 'requests';
}
