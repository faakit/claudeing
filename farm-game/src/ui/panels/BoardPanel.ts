import Phaser from 'phaser';
import { audio } from '../../platform/audio';
import { haptic } from '../../platform/haptics';
import { getState } from '../../state/store';
import {
  deliverOrder,
  ensureOrders,
  haveFor,
  keepForRequests,
  orderLabel,
} from '../../systems/orders';
import { countItem } from '../../systems/inventory';
import { orderSub } from './boardText';
import { iconKey, parseKey } from '../../systems/itemRef';
import { C } from '../theme';
import { wrapText } from '../fontMetrics';
import { Modal } from '../widgets';
import { gameEvents } from '../../systems/events';
import { festivalToday, hasEntered } from '../../systems/festivals';
import { fmt } from './format';
import { cartStock } from '../../systems/cart';
import { items } from '../../data';
import { giveToSpecial, specialGiveCount, specialSub, specialTitle } from '../../systems/specials';
import {
  applyRival,
  boardScoreLine,
  rivalName,
  rivalNotice,
  rivalTargets,
} from '../../systems/rival';
import { fmtGold, t } from '../../i18n';
import {
  isTaken,
  jobGiver,
  jobText,
  jobProgress,
  jobReady,
  PAID_AT_PAYOUT,
  takeJob,
  turnInJob,
  welcomeFactor,
  welcomeJobsHeader,
} from '../../systems/jobs';
import type { GameState } from '../../state/GameState';
import { boardStartPage, todaysJobs, type BoardPage as Page } from './boardStart';

/**
 * The town board: the day's small jobs (taken here, turned in here; bait round) on one page and the requests (three
 * orders a day, paid well above the bin, Clay's race, the special, festivals, the cart, projects) on the other.
 */
export class BoardPanel extends Modal {
  constructor(scene: Phaser.Scene) {
    super(scene, 196);
  }

  /**
   * The special just finished while the sheet is open: its row stays as "Special done!" until the board closes,
   * so the rows above never slide under the thumb (critique 11, F7).
   */
  private doneSpecial: string | null = null;
  private page: Page = 'requests';

  override open(): void {
    this.doneSpecial = null;
    this.page = boardStartPage(getState());
    super.open();
  }

  /** The two page tabs under the title; the open one is lit. */
  private tabs(s: GameState, y: number): void {
    const jobsOpen = todaysJobs(s).filter((j) => !j.done).length;
    const reqOpen = s.orders.list.filter((o) => !o.done).length + (s.special ? 1 : 0);
    const w = (this.panelW - 20) / 2;
    const tab = (x: number, page: Page, label: string) =>
      this.button(
        x,
        y,
        w,
        18,
        label,
        () => {
          if (this.page === page) return;
          this.page = page;
          audio.play('ui');
          this.rebuild();
        },
        this.page === page ? { textColor: C.gold, rim: C.gold } : { textColor: C.creamDim },
      );
    tab(8, 'jobs', t('board.tabJobs', { n: jobsOpen }));
    tab(12 + w, 'requests', t('board.tabRequests', { n: reqOpen }));
  }

  /** The jobs page: each of today's jobs with Take, Turn in or Done. */
  private buildJobs(s: GameState): void {
    const list = todaysJobs(s);
    const rows = Math.max(1, list.length);
    this.setHeight(52 + 12 + rows * 26 + 34);
    this.panel();
    this.label(8, 8, t('board.townTitle'), C.gold);
    this.label(192, 8, t('bag.gold', { gold: fmt(s.money) }), C.gold, 1, 'right');
    this.tabs(s, 20);
    let y = 42;
    this.label(
      8,
      y,
      welcomeJobsHeader(list.length > 0 ? welcomeFactor(s.jobs.day) : 1),
      C.creamDim,
    );
    y += 12;
    if (list.length === 0) {
      this.label(8, y + 6, t('board.jobsNone'), C.creamDim, 1, 'left', 184);
      y += 26;
    }
    list.forEach((job, i) => {
      const taken = isTaken(s, job);
      const ready = jobReady(s, job);
      const tonight = ready && PAID_AT_PAYOUT.has(job.stat);
      const gold = fmtGold(job.reward);
      y = this.row(y, {
        title: jobText(job),
        // who asked, then where it stands: "Finn  Pays 22g", "Finn  Doing 1/2  22g", "Finn  Done! Turn in: 22g"
        sub: t('board.jobSub', {
          who: jobGiver(job),
          what: job.done
            ? t('board.thanks')
            : tonight
              ? t('board.jobTonight', { gold })
              : ready
                ? t('board.jobReady', { gold })
                : taken
                  ? t('board.jobDoing', { have: jobProgress(s, job), n: job.n, gold })
                  : t('board.jobOffer', { gold }),
        }),
        subColor: job.done ? C.green : ready ? C.gold : C.creamDim,
        // A button only where there is something to do: Take, or Turn in once it is done. A job under way, paid or
        // paid tonight says so on its second line (a hatched "Turn in" read as nothing; critic D2-3).
        buttons:
          job.done || tonight || (taken && !ready)
            ? []
            : taken
              ? [
                  {
                    label: t('board.turnIn'),
                    width: 44,
                    enabled: true,
                    color: C.green,
                    onClick: () => {
                      if (turnInJob(getState(), i)) {
                        audio.play('order');
                        haptic('success');
                      } else audio.play('error');
                      this.rebuild();
                    },
                  },
                ]
              : [
                  {
                    label: t('board.take'),
                    width: 44,
                    enabled: true,
                    color: C.green,
                    onClick: () => {
                      if (takeJob(getState(), i)) {
                        audio.play('buy');
                        haptic('success');
                      } else audio.play('error');
                      this.rebuild();
                    },
                  },
                ],
      });
    });
    this.closeButton();
  }

  protected build(): void {
    const s = getState();
    if (this.page === 'jobs') return this.buildJobs(s);
    ensureOrders(s);
    applyRival(s);
    // Rows, then the festival and projects buttons, then Close: the sheet grows with the board.
    const fest = festivalToday(s);
    const festOpen = !!fest && !hasEntered(s, fest.id);
    const cartOpen = cartStock(s).length > 0;
    const rows = Math.max(1, s.orders.list.length);
    const sp = s.special;
    // Once Clay is about, the season's score has a line of its own, every day (critique 9, F1).
    const score = boardScoreLine(s);
    // Clay's notice wraps (pt-BR ran 59 px past the edge on one line), under the tab row; the rows start under however
    // many lines it takes
    const noticeY = score ? 52 : 42;
    const notice = rivalNotice(s);
    const top = noticeY + wrapText(notice, 184).length * 11 + 3;
    this.setHeight(
      top +
        (sp || this.doneSpecial ? 26 : 0) +
        rows * 26 +
        (festOpen ? 26 : 0) +
        (cartOpen ? 26 : 0) +
        26 +
        34,
    );
    this.panel();
    this.label(8, 8, t('board.townTitle'), C.gold);
    this.label(192, 8, t('bag.gold', { gold: fmt(s.money) }), C.gold, 1, 'right');
    this.tabs(s, 20);
    if (score) this.label(8, 41, score, C.cream);
    this.label(8, noticeY, notice, C.creamDim, 1, 'left', 184);
    let y = top;
    // The requests Clay is after today that would score are marked, so the race is about a known target
    // (a fish or wild row he only clears is not: critique 10, F2).
    const eyed = new Set(rivalTargets(s).map((o) => o.id));
    // Requests first, the special last: a hurried first tap goes to a request, not to the special
    // (critique 9, F5).
    for (const o of s.orders.list) {
      const have = haveFor(s, o);
      const ready = !o.done && have >= o.qty;
      y = this.row(y, {
        icon: iconKey(parseKey(o.item)),
        title: o.done && !o.rival ? t('board.doneTitle', { order: orderLabel(o) }) : orderLabel(o),
        sub: o.rival
          ? o.noPoint
            ? t('board.rivalTook', { name: rivalName() })
            : t('board.rivalFilled', { name: rivalName() })
          : o.done
            ? t('board.thanks')
            : orderSub(s, o, have, eyed.has(o.id)),
        subColor:
          o.rival || (eyed.has(o.id) && !ready)
            ? C.warn
            : o.done
              ? C.green
              : ready
                ? C.gold
                : C.creamDim,
        buttons: [
          {
            label: o.rival ? t('board.gone') : o.done ? t('common.done') : t('common.give'),
            width: 36,
            enabled: ready,
            color: ready ? C.green : C.creamDim,
            onClick: () => {
              if (deliverOrder(getState(), o.id) === 'ok') {
                audio.play('order');
                haptic('success');
              } else audio.play('error');
              this.rebuild();
            },
          },
        ],
      });
    }
    if (s.orders.list.length === 0) {
      this.label(8, y + 6, t('board.nothing'), C.creamDim, 1, 'left', 184);
      y += 26;
    }
    if (sp) {
      // The special order, in gold: a big seasonal request with a deadline. Its Give keeps back what the
      // same-item requests need, even one you are part-way to (critique 9, F3), and says how many it gives.
      const keep = keepForRequests(s, sp.item);
      const give = specialGiveCount(s, keep);
      y = this.row(y, {
        icon: items[sp.item]?.icon,
        title: specialTitle(sp),
        // When every one you carry is spoken for by a request, say so instead of offering them.
        sub:
          give === 0 && keep > 0 && countItem(s, sp.item) > 0
            ? t('board.savedForRequest')
            : specialSub(sp),
        subColor: C.gold,
        buttons: [
          {
            label: give > 0 ? t('board.giveN', { n: give }) : t('common.give'),
            width: 40, // "Give 15" needs the room; the request rows keep 36 for their longer lines
            enabled: give > 0,
            color: give > 0 ? C.green : C.creamDim,
            onClick: () => {
              const title = specialTitle(sp);
              const res = giveToSpecial(getState(), keepForRequests(getState(), sp.item));
              if (res.ok && res.finished) this.doneSpecial = title;
              if (res.ok) {
                audio.play(res.finished ? 'order' : 'buy');
                haptic('success');
              } else audio.play('error');
              this.rebuild();
            },
          },
        ],
      });
    }
    if (!sp && this.doneSpecial)
      y = this.row(y, {
        title: this.doneSpecial,
        sub: t('board.specialDone'),
        subColor: C.green,
        buttons: [
          {
            label: t('common.done'),
            width: 40,
            enabled: false,
            color: C.creamDim,
            onClick: () => {},
          },
        ],
      });
    if (fest && festOpen) {
      this.button(
        8,
        y + 2,
        this.panelW - 16,
        22,
        t('board.enterFestival', { festival: fest.def.name }),
        () => {
          this.close();
          gameEvents.emit('openPanel', { type: 'festival' });
        },
        { textColor: C.gold, rim: C.gold },
      );
      y += 26;
    }
    if (cartOpen) {
      this.button(
        8,
        y + 2,
        this.panelW - 16,
        22,
        t('board.cartHere'),
        () => {
          this.close();
          gameEvents.emit('openPanel', { type: 'cart' });
        },
        { textColor: C.gold, rim: C.gold },
      );
      y += 26;
    }
    this.button(8, y + 2, this.panelW - 16, 22, t('board.projects'), () => {
      this.close();
      gameEvents.emit('openPanel', { type: 'projects' });
    });
    this.closeButton();
  }
}
