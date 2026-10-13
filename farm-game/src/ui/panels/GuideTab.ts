import { guide } from '../../data';
import { getState } from '../../state/store';
import { guideTopics, readTopic, topicRead, unreadTopics } from '../../systems/reveal';
import { C } from '../theme';
import { buildAlmanac } from './AlmanacTab';
import type { MenuTabContext } from './MenuPanel';
import { t } from '../../i18n';

/**
 * The Book tab: two pages, the Guide (short pages to reread: gold, the planting cycle, skills, friends...; QA round)
 * and Goods (the almanac). The Guide's topics arrive with the reveal schedule (systems/reveal.ts); one not opened yet
 * is marked NEW. Content is data (`data/guide.json`); this draws it plainly (the UI lane owns the look).
 *
 * Coach targets: the page buttons ("Guide", "Goods"), each topic's button (its title) and "Back".
 */
type Page = 'guide' | 'goods';
const view: { page: Page | null; topic: string | null; from: number; list: number } = {
  page: null,
  topic: null,
  from: 0,
  list: 0,
};

/** Open the Book on one Guide topic (a "How skills grow" button, a coach step). */
export function showGuideTopic(id: string): void {
  view.page = 'guide';
  view.topic = id;
  view.from = 0;
}

/** Forget the Book's place (a new game, tests). */
export function resetGuideView(): void {
  view.page = null;
  view.topic = null;
  view.from = 0;
  view.list = 0;
}

const ROW = 22;
const TOGGLE_H = 18;

export function buildBook(c: MenuTabContext): void {
  const s = getState();
  // Opens on the Guide while a page is unread, else where the player left it.
  const page: Page = view.page ?? (unreadTopics(s).length > 0 ? 'guide' : 'goods');
  const tab = (x: number, p: Page, label: string): void => {
    c.button(
      x,
      c.top - 2,
      90,
      TOGGLE_H,
      label,
      () => {
        view.page = p;
        view.topic = null;
        c.rebuild();
      },
      { rim: page === p ? C.select : C.creamDim, textColor: page === p ? C.gold : C.cream },
    );
  };
  tab(8, 'guide', t('guide.pageGuide'));
  tab(102, 'goods', t('guide.pageGoods'));
  const body: MenuTabContext = { ...c, top: c.top + TOGGLE_H + 4 };
  if (page === 'goods') return buildAlmanac(body);
  if (view.topic && guide.topics.some((g) => g.id === view.topic)) return buildTopic(body);
  buildList(body);
}

function buildList(c: MenuTabContext): void {
  const s = getState();
  const topics = guideTopics(s);
  if (topics.length === 0) {
    c.label(8, c.top + 4, t('guide.empty'), C.creamDim, 1, 'left', 184);
    return;
  }
  const per = Math.max(1, Math.floor((c.bottom - 24 - c.top) / ROW));
  const screens = Math.ceil(topics.length / per);
  view.list = Math.min(view.list, screens - 1);
  topics.slice(view.list * per, (view.list + 1) * per).forEach((topic, i) => {
    const y = c.top + i * ROW;
    c.button(8, y, 184, ROW - 2, topic.title, () => {
      view.topic = topic.id;
      view.from = 0;
      readTopic(getState(), topic.id);
      c.rebuild();
    });
    if (!topicRead(s, topic.id)) c.label(186, y + 6, t('guide.new'), C.gold, 1, 'right');
  });
  if (screens > 1) {
    const by = c.bottom - 22;
    c.button(8, by, 40, 20, '<', () => {
      view.list = (view.list + screens - 1) % screens;
      c.rebuild();
    });
    c.label(100, by + 6, `${view.list + 1}/${screens}`, C.creamDim, 1, 'center');
    c.button(152, by, 40, 20, '>', () => {
      view.list = (view.list + 1) % screens;
      c.rebuild();
    });
  }
}

function buildTopic(c: MenuTabContext): void {
  const topic = guide.topics.find((g) => g.id === view.topic)!;
  readTopic(getState(), topic.id);
  let y = c.top;
  c.label(8, y, topic.title.toUpperCase(), C.gold, 1, 'left', 184);
  y += 14;
  const floor = c.bottom - 26;
  let i = view.from;
  for (; i < topic.paras.length; i++) {
    const para = c.label(8, y, topic.paras[i]!, C.cream, 1, 'left', 184);
    // a paragraph that would run into the buttons waits for the next screen (unless it is the first one shown)
    if (y + para.textHeight > floor && i > view.from) {
      para.destroy();
      break;
    }
    y += para.textHeight + 6;
  }
  const by = c.bottom - 22;
  c.button(8, by, 60, 20, t('common.back'), () => {
    if (view.from > 0) view.from = 0;
    else view.topic = null;
    c.rebuild();
  });
  if (i < topic.paras.length) {
    const next = i;
    c.button(132, by, 60, 20, t('guide.more'), () => {
      view.from = next;
      c.rebuild();
    });
  }
}
