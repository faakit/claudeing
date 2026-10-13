// QA item "Os dois tiles de baixo estão bugados no terreno inicial": on a fresh game, read what the till rule says for
// every tile of the starting field's dirt (the home plot and the rows around it), and shoot the field on screen.
// Scenario: day1-fresh (guided start on), and with &tutorial=0.
//   URL=http://localhost:5281/ PROFILE=se node agents/probes/start-plot.mjs
import { launch, openScenario, serve } from '../../scripts/lib/farm.mjs';

const { url, stop } = await serve(Number(process.env.PORT ?? 4892));
const browser = await launch();
const profile = process.env.PROFILE ?? 'i13';
try {
  for (const query of ['', '&tutorial=0']) {
    const farm = await openScenario(browser, url, 'day1-fresh', { profile, query });
    await farm.idle();
    const tag = `start-plot-${profile}${query ? '-bare' : ''}`;
    await farm.shot(`${tag}-arrival`);
    // Every dirt tile x 4-13, y 15-26: T tillable (owned), x refused as not owned, - not farm dirt
    const grid = await farm.eval(() => {
      const f = window.__farm;
      const w = f.game.scene.getScenes(true).find((x) => x.grid);
      const rows = [];
      for (let ty = 15; ty <= 26; ty++) {
        let row = `${String(ty).padStart(2)} `;
        for (let tx = 4; tx <= 13; tx++) {
          const t = w.tileInfo({ tx, ty });
          row += !t.tillable || t.blocked ? ' -' : t.owned ? ' T' : ' x';
        }
        rows.push(row);
      }
      const cam = w.cameras.main;
      return { rows, cam: [cam.scrollX, cam.scrollY], player: f.getState().player };
    });
    console.log(tag, 'x 4..13', JSON.stringify(grid.cam), grid.player.x, grid.player.y);
    console.log(grid.rows.join('\n'));
    // where the bottom rows of the home plot sit on screen once the farmer stands in the plot
    await farm.eval(() => {
      const p = window.__farm.getState().player;
      p.x = 10 * 16 + 8;
      p.y = 20 * 16 + 11;
    });
    await farm.idle(20);
    const ys = await farm.eval(() =>
      [22, 23, 24, 25].map((y) => [y, window.__farm.dev.tileToScreen(10, y)?.y]),
    );
    console.log('screen y of rows 22-25 with the farmer at (10,20):', JSON.stringify(ys));
    await farm.shot(`${tag}-in-plot`);
    if (farm.errors.length) console.log('errors', farm.errors);
    await farm.close();
  }
} finally {
  await browser.close();
  stop();
}
