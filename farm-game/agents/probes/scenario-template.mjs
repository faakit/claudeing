// Template for new probes and critic checks: open a named scenario on a phone profile and hand, do something,
// wait on the game (never a fixed timeout), take named screenshots. Copy it and change the middle part.
//
//   npm run build && SCENARIO=coop-hens PROFILE=se HAND=left node agents/probes/scenario-template.mjs
//   URL=http://localhost:5195/ SCENARIO=lab node agents/probes/scenario-template.mjs   (against `npm run dev`)
//
// Shots go to agents/out/shots (SHOTS=<dir> to change). Cite the scenario name in every finding.
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const scenario = process.env.SCENARIO ?? 'lab';
const profile = process.env.PROFILE ?? 'i13';
const hand = process.env.HAND ?? 'right';
const { url, stop } = await serve(Number(process.env.PORT ?? 4890));
const browser = await launch();
try {
  const farm = await openScenario(browser, url, scenario, { profile, hand });
  const tag = `${scenario}-${profile}-${hand}`;
  console.log('opened', tag, 'at', (await farm.state()).player);
  await farm.shot(`${tag}-start`);

  // --- your steps: each one waits on the game ---
  const act = await farm.act(); // Action, resolved on its result
  console.log('Action:', JSON.stringify(act.used), act.ok ? 'ok' : 'refused');
  await farm.idle();
  await farm.shot(`${tag}-after-action`);
  await farm.interact(); // Interact, then idle
  const sheet = await farm.openSheet();
  if (sheet) await farm.shot(`${tag}-sheet-${sheet}`);
  await farm.strip(`${tag}-strip`, 4, 6); // four frames, six frames apart, exactly

  console.log('console errors:', farm.errors.length ? farm.errors : 'none');
  await farm.close();
} finally {
  await browser.close();
  stop();
}
