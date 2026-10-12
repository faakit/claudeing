// Cloud save probe: every cloud scenario on a phone profile, screenshots of the dialog, the title and Options.
//
//   npm run build && PROFILE=se node agents/probes/cloud-save.mjs
//   URL=http://localhost:5351/ node agents/probes/cloud-save.mjs   (against `npm run dev`)
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const profile = process.env.PROFILE ?? 'i13';
const hand = process.env.HAND ?? 'right';
const { url, stop } = await serve(Number(process.env.PORT ?? 4891));
const browser = await launch();
const tag = (s) => `cloud-${s}-${profile}-${hand}`;
/** Tap a title button by its text (the title is not the UI scene, so tapButton cannot see it). */
async function tapTitle(farm, re) {
  const at = await farm.eval((src) => {
    const re = new RegExp(src, 'i');
    const b = window.__farm.game.scene.getScene('Title').buttons.find((x) => re.test(x.text));
    return b ? { x: b.x + b.bw / 2, y: b.y + b.bh / 2 } : null;
  }, re.source);
  if (!at) throw new Error(`no title button ${re}`);
  await farm.thumb.tap(at.x, at.y, 60);
}
async function options(farm) {
  await farm.tapButton('MENU');
  await farm.panel('menu');
  await farm.tapButton(/^opts?$/i);
  await farm.idle();
}
try {
  for (const s of ['cloud-conflict', 'cloud-diverged', 'lang-pt-cloud-conflict']) {
    const farm = await openScenario(browser, url, s, { profile, hand });
    await farm.panel('cloudPanel');
    console.log(s, JSON.stringify(await farm.eval(() => window.__farm.dev.cloud.conflict)));
    await farm.shot(tag(s));
    console.log('errors:', farm.errors);
    await farm.close();
  }
  {
    const farm = await openScenario(browser, url, 'cloud-title', { profile, hand });
    await farm.shot(tag('title'));
    await tapTitle(farm, /this phone|este celular/);
    await farm.eval(() => window.__farm.dev.wait.until(() => window.__farm.game.scene.getScene('Title').cloudPanel?.isOpen, 'dialog'));
    await farm.frames(20); // the sheet's slide (the title never goes idle: its crops sway)
    await farm.shot(tag('title-dialog'));
    console.log('errors:', farm.errors);
    await farm.close();
  }
  for (const s of ['cloud-signed-in', 'cloud-signed-out', 'cloud-offline']) {
    const farm = await openScenario(browser, url, s, { profile, hand });
    await options(farm);
    await farm.shot(tag(`${s}-opts`));
    await farm.tapButton(/^cloud/i);
    await farm.idle();
    await farm.shot(tag(`${s}-page`));
    console.log(s, JSON.stringify(await farm.eval(() => window.__farm.dev.cloud.status)), 'errors:', farm.errors);
    await farm.close();
  }
} finally {
  await browser.close();
  stop();
}
