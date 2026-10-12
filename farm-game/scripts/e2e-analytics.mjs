// Analytics e2e, on the dev provider (events stay in the page; nothing is sent anywhere). Run `npm run build` first.
//
// 1. Consent (scenario analytics-consent, `&analytics=dev&consent=ask`): the title asks before New Game; nothing is
//    delivered while it waits; No thanks empties the queue and records nothing more; Share delivers what waited, in
//    order.
// 2. Opt-out (scenario analytics-first-harvest, `&analytics=dev`): the first harvest reports once; Menu > Opts >
//    Share stats turns it off (queue emptied, nothing more recorded) and back on; Fullscreen moved to Controls....
// 3. Off by default: Opts keeps Fullscreen and has no switch, as before.
// 3. Off by default: a plain debug page has no provider, no record in storage, no switch in Controls.
//
// The tutorial funnel (every guided step once, in order, then the completion) is checked by e2e:onboarding, which
// plays the guided start with `&analytics=dev`.
//
// Env: E2E_ANALYTICS_PORT (default E2E_PORT + 35), URL= (a running server), SHOTS=<dir>.
import { checker, launch, openScenario, serve } from './lib/farm.mjs';

const PORT = Number(process.env.E2E_ANALYTICS_PORT ?? Number(process.env.E2E_PORT ?? 4173) + 35);
const c = checker();
const { url, stop } = await serve(PORT);
const browser = await launch();

/** The dev provider's delivered log, after a flush (the layer batches on a 10 s timer). */
const delivered = (farm) =>
  farm.eval(async () => {
    const a = window.__farm.analytics;
    await a.flush();
    return a.log();
  });
const queued = (farm) => farm.eval(() => window.__farm.analytics.queue());
const consent = (farm) => farm.eval(() => window.__farm.analytics.consent);
const names = (log) => log.map((e) => e.name);
/** The title's live buttons: label and centre (logical px). */
const titleButtons = (farm) =>
  farm.eval(() => {
    const textOf = (n) =>
      n.main?.text ? n.main.text : (n.list ?? []).map(textOf).join(' ').trim();
    return window.__farm.game.scene
      .getScene('Title')
      .buttons.filter((b) => b.active)
      .map((b) => {
        const r = b.getBounds();
        return { text: textOf(b), x: r.centerX, y: r.centerY };
      });
  });
const waitTitleButton = async (farm, re) => {
  for (let i = 0; i < 100; i++) {
    const hit = (await titleButtons(farm)).find((b) => re.test(b.text));
    if (hit) return hit;
    await farm.frames(3);
  }
  throw new Error(`no title button ${re}: ${JSON.stringify(await titleButtons(farm))}`);
};
const tapTitle = async (farm, re) => {
  const b = await waitTitleButton(farm, re);
  await farm.thumb.tap(b.x, b.y, 70);
};
const startGame = async (farm) => {
  await tapTitle(farm, /^New Game$/);
  await farm.page.waitForFunction(
    () => window.__farm.game.scene.getScene('UI')?.sys.isActive(),
    null,
    {
      timeout: 20000,
    },
  );
  await farm.ready();
};

try {
  // ---------------------------------------------------------------- 1. consent: No thanks
  {
    const farm = await openScenario(browser, url, 'analytics-consent', {
      query: '&analytics=dev&consent=ask',
    });
    await waitTitleButton(farm, /^No thanks$/);
    const labels = (await titleButtons(farm)).map((b) => b.text);
    c.check(
      'consent: the title asks (Share, No thanks) instead of New Game',
      labels.includes('Share') && labels.includes('No thanks') && !labels.includes('New Game'),
      JSON.stringify(labels),
    );
    await farm.shot('analytics-consent');
    c.check('consent: nothing delivered while unanswered', (await delivered(farm)).length === 0);
    const q0 = names(await queued(farm));
    c.check(
      'consent: first_open and session_start wait in the local queue',
      q0[0] === 'first_open' && q0[1] === 'session_start',
      JSON.stringify(q0),
    );
    await tapTitle(farm, /^No thanks$/);
    await waitTitleButton(farm, /^New Game$/);
    c.check(
      'No thanks: consent denied, queue emptied',
      (await consent(farm)) === 'denied' && (await queued(farm)).length === 0,
    );
    await startGame(farm);
    await farm.eval(() => window.__farm.dev.time.skipDays(1));
    c.check(
      'No thanks: a new game and a new day record nothing',
      (await delivered(farm)).length === 0 && (await queued(farm)).length === 0,
      JSON.stringify(await queued(farm)),
    );
    c.check('No thanks: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
    await farm.close();
  }

  // ---------------------------------------------------------------- 1b. consent: Share
  {
    const farm = await openScenario(browser, url, 'analytics-consent', {
      query: '&analytics=dev&consent=ask',
    });
    await tapTitle(farm, /^Share$/);
    await waitTitleButton(farm, /^New Game$/);
    c.check('Share: consent granted', (await consent(farm)) === 'granted');
    await startGame(farm);
    const log = await delivered(farm);
    const n = names(log);
    c.check(
      'Share: what waited is delivered first, in order, then the game day',
      n[0] === 'first_open' && n[1] === 'session_start' && n.includes('day_start'),
      JSON.stringify(n),
    );
    c.check(
      'Share: day_start is game day 1',
      log.find((e) => e.name === 'day_start')?.params.game_day === 1,
    );
    c.check('Share: first_open once', n.filter((x) => x === 'first_open').length === 1);
    await farm.close();
  }

  // ---------------------------------------------------------------- 2. a milestone, then the opt-out switch
  {
    const farm = await openScenario(browser, url, 'analytics-first-harvest', {
      query: '&analytics=dev',
    });
    c.check(
      'dev provider: consent given by default (nothing leaves the page)',
      (await consent(farm)) === 'granted',
    );
    await farm.act();
    await farm.idle();
    await farm.act();
    await farm.idle();
    let log = await delivered(farm);
    const harvests = log.filter((e) => e.name === 'first_harvest');
    c.check(
      'first harvest: first_harvest once, with the game day',
      harvests.length === 1 && harvests[0].params.game_day === 1,
      JSON.stringify(names(log)),
    );
    // Menu > Opts: the switch takes Fullscreen's cell on the Left hand row
    await farm.tapButton('MENU');
    await farm.panel('menu');
    await farm.tapButton(/^Opts$/);
    await farm.frames(2);
    const opts = await farm.targets();
    const sw = opts.find((t) => /^Share stats:/.test(t.text));
    const lh = opts.find((t) => /^Left hand:/.test(t.text));
    c.check(
      'Menu > Opts shows Share stats: ON beside Left hand, and no Fullscreen there',
      sw?.text === 'Share stats: ON' &&
        Math.abs(sw.cy - lh?.cy) < 2 &&
        !opts.some((t) => /^Fullscreen$/.test(t.text)),
      JSON.stringify(opts.map((t) => t.text)),
    );
    await farm.shot('analytics-opts-on');
    // something waiting in the queue when the player turns it off
    await farm.eval(() => window.__farm.gameEvents.emit('languageChosen', { lang: 'en' }));
    c.check('a queued event waits for its batch', (await queued(farm)).length > 0);
    await farm.tapButton(/^Share stats:/);
    await farm.frames(2);
    const off = (await farm.targets()).find((t) => /^Share stats:/.test(t.text));
    c.check('the switch reads OFF', off?.text === 'Share stats: OFF', JSON.stringify(off));
    c.check(
      'off: consent denied, the queue emptied at once',
      (await consent(farm)) === 'denied' && (await queued(farm)).length === 0,
    );
    await farm.shot('analytics-opts-off');
    const before = (await delivered(farm)).length;
    await farm.eval(() => {
      const f = window.__farm;
      f.gameEvents.emit('languageChosen', { lang: 'pt-BR' });
      f.dev.time.skipDays(1);
    });
    log = await delivered(farm);
    c.check(
      'off: nothing more is recorded or delivered',
      log.length === before && (await queued(farm)).length === 0,
      JSON.stringify(names(log.slice(before))),
    );
    await farm.tapButton(/^Share stats:/);
    await farm.frames(2);
    log = await delivered(farm);
    c.check(
      'back on: a new session starts (session_start n=2)',
      log.at(-1)?.name === 'session_start' && log.at(-1)?.params.n === 2,
      JSON.stringify(log.at(-1)),
    );
    await farm.tapButton(/^Controls/);
    await farm.frames(2);
    const ctl = (await farm.targets()).map((t) => t.text);
    c.check(
      'Controls... has Fullscreen (moved from Opts) and Replay guide beside Back',
      ctl.includes('Fullscreen') && ctl.includes('Replay guide') && ctl.includes('Back'),
      JSON.stringify(ctl),
    );
    await farm.shot('analytics-controls');
    c.check('opt-out: no console errors', farm.errors.length === 0, farm.errors.join(' | '));
    await farm.close();
  }

  // ---------------------------------------------------------------- 3. off by default
  {
    const farm = await openScenario(browser, url, 'analytics-first-harvest');
    const s = await farm.eval(() => ({
      provider: window.__farm.analytics.provider,
      summary: window.__farm.analytics.summary(),
    }));
    c.check(
      'no config: the no-op provider, no record at all',
      s.provider === 'noop' && s.summary === null,
      JSON.stringify(s),
    );
    await farm.tapButton('MENU');
    await farm.panel('menu');
    await farm.tapButton(/^Opts$/);
    await farm.frames(2);
    const o = (await farm.targets()).map((x) => x.text);
    c.check(
      'no config: Opts has Fullscreen and no Share stats switch (as today)',
      !o.some((x) => /^Share stats/.test(x)) && o.includes('Fullscreen'),
      JSON.stringify(o),
    );
    await farm.tapButton(/^Controls/);
    await farm.frames(2);
    const t = (await farm.targets()).map((x) => x.text);
    c.check(
      'no config: Controls is as today (no Fullscreen, Replay guide in the switch rows)',
      !t.includes('Fullscreen') && t.includes('Replay guide'),
      JSON.stringify(t),
    );
    await farm.close();
  }
} finally {
  await browser.close();
  stop();
}
console.log(
  c.failed === 0 ? `\nANALYTICS E2E OK (${c.passed})` : `\nANALYTICS E2E FAILED (${c.failed})`,
);
process.exit(c.failed === 0 ? 0 : 1);
