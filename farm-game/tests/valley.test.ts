import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { mail, npcs, tutorial, valley } from '../src/data';
import {
  dryCategory,
  PALETTE,
  remapDry,
  rgbRemap,
  slotCategories,
  DRY_REMAP,
} from '../src/art/dryPalette';
import { tilesetFor } from '../src/art/mapLayers';
import { chooseAmbience, DRY_BIRDS } from '../src/audio/director';
import { endDay } from '../src/systems/day';
import { isShippable } from '../src/systems/economy';
import {
  completeEvent,
  isGiftable,
  lineFor,
  linesNow,
  lineText,
  pendingEvent,
  POINTS_PER_HEART,
} from '../src/systems/friendship';
import { countItem } from '../src/systems/inventory';
import { sellValue } from '../src/systems/itemRef';
import { takeGift } from '../src/systems/mail';
import { migrate } from '../src/systems/save';
import {
  checkFarmGreen,
  dryMaps,
  FARM_GREEN,
  GREEN_SEEN,
  mapLook,
  paletteOf,
  revealPending,
  valleyStage,
  takeFirstGreenMoment,
  valleyHolds,
} from '../src/systems/valley';
import { measureText, wrapText } from '../src/ui/fontMetrics';
import { giftLine } from '../src/ui/panels/mailText';
import { arrangeNotes } from '../src/ui/panels/summaryNotes';
import { letterLayout, LETTER_CARD, TITLE_BUTTON_H } from '../src/ui/titleLetter';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';
import { STATE_VERSION } from '../src/state/GameState';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });
const onDay = (day: number, shipped: number): GameState => {
  const s = newState();
  s.time.day = day;
  s.stats['shipped'] = shipped;
  return s;
};

describe('the valley: how maps look', () => {
  it('the farm is on the dry palette until the first green, then as it always was', () => {
    const s = newState();
    expect(mapLook(s, 'farm')).toEqual({ file: 'assets/maps/farm@dry.tmj', palette: 'dry' });
    expect(paletteOf(s, 'farm')).toBe('dry');
    expect(dryMaps(s)).toEqual(['farm', 'town', 'wendhead']);
    s.stats[FARM_GREEN] = 1;
    expect(mapLook(s, 'farm')).toEqual({ file: 'assets/maps/farm@waking.tmj' });
    expect(paletteOf(s, 'farm')).toBeNull();
    // Wendhead is straw until the spring opens (coordinator ruling), the town until the weir does (M6)
    expect(dryMaps(s)).toEqual(['town', 'wendhead']);
    s.stats['place.spring'] = 3;
    expect(dryMaps(s)).toEqual(['town']);
    s.stats['place.weir'] = 3;
    expect(dryMaps(s)).toEqual([]);
  });

  it("the farm's dry stage and the dry palette switch on the same stat", () => {
    const s = newState();
    for (const green of [0, 1, 0]) {
      s.stats[FARM_GREEN] = green;
      expect(valleyStage(s, 'farm').variant === 'dry').toBe(paletteOf(s, 'farm') === 'dry');
      expect(paletteOf(s, 'farm') === 'dry').toBe(green === 0);
    }
  });

  it('the dry tileset is held on the first-green morning until the farmer has stepped out', () => {
    const s = newState();
    expect(revealPending(s)).toBe(false);
    s.stats[FARM_GREEN] = 1;
    expect(revealPending(s)).toBe(true);
    takeFirstGreenMoment(s);
    expect(revealPending(s)).toBe(false);
  });

  it('maps with no rows look as they always have', () => {
    const s = newState();
    for (const m of ['woods', 'mine', 'house']) expect(paletteOf(s, m), m).toBeNull();
  });

  it('conditions read stats and places, with min and max', () => {
    const s = newState();
    expect(valleyHolds(s, undefined)).toBe(true);
    expect(valleyHolds(s, { place: 'spring', max: 2 })).toBe(true);
    expect(valleyHolds(s, { place: 'spring', min: 3 })).toBe(false);
    s.stats['place.spring'] = 3;
    expect(valleyHolds(s, { place: 'spring', min: 3 })).toBe(true);
    expect(valleyHolds(s, { stat: 'shipped', min: 1 })).toBe(false);
  });

  it('the tileset lookup takes the palette and falls back while the dry tiles are not resident', () => {
    const has = (keys: string[]) => ({ exists: (k: string) => keys.includes(k) });
    expect(tilesetFor(has(['tiles_placeholder_dry']), 'spring', true, 'dry').key).toBe(
      'tiles_placeholder_dry',
    );
    expect(tilesetFor(has(['tiles_placeholder_summer_dry']), 'summer', true, 'dry').key).toBe(
      'tiles_placeholder_summer_dry',
    );
    expect(tilesetFor(has(['tiles_placeholder_summer']), 'summer', true, 'dry').key).toBe(
      'tiles_placeholder_summer',
    );
    // indoors never takes a palette
    expect(tilesetFor(has(['tiles_placeholder_dry']), 'spring', false, 'dry').key).toBe(
      'tiles_placeholder',
    );
  });
});

describe('the dry palette', () => {
  it('stays on the palette, never touches water, and the crowns never turn autumn orange or gold', () => {
    for (const [cat, table] of Object.entries(DRY_REMAP))
      for (const [from, to] of Object.entries(table)) {
        expect(PALETTE[from], from).toBeDefined();
        expect(PALETTE[to], to).toBeDefined();
        expect(['water', 'sky', 'dusk blue', 'night navy']).not.toContain(from);
        expect(['orange', 'red']).not.toContain(to);
        // golden straw flecks the ground; crowns stay grey-green (fall is told by orange and gold crowns)
        if (cat === 'foliage' || cat === 'evergreen') expect(['gold']).not.toContain(to);
      }
  });

  it('remaps grass and crowns, never roofs, ponds or props', () => {
    expect(dryCategory('base_grass_0')).toBe('ground');
    expect(dryCategory('ao:16282:10:10:000000010')).toBe('ground');
    expect(dryCategory('crown:189:0:0:o:o1_23_35_16_62_t')).toBe('foliage');
    expect(dryCategory('crown:189:0:0:o:p1_23_35_16_62_t')).toBe('evergreen');
    expect(dryCategory('roof_red_0')).toBeNull();
    expect(dryCategory('lily_0')).toBeNull();
    expect(dryCategory('water')).toBeNull();
    expect(dryCategory('p_barrel')).toBeNull();
  });

  it('the first name using a slot decides its category (as seasons.py)', () => {
    const cats = slotCategories({ grass: 0, p_barrel: 1, base_grass_1: 1, roof_x: 2, gone: -1 });
    expect(cats.get(0)).toBe('ground');
    expect(cats.has(1)).toBe(false);
    expect(cats.has(2)).toBe(false);
  });

  it('remaps a ground tile pixel to straw and leaves water alone', () => {
    const px = new Uint8ClampedArray(16 * 32 * 4);
    const put = (x: number, rgb: number[]) => px.set([...rgb, 255], x * 4);
    put(0, PALETTE['grass']!); // tile 0 (ground)
    put(16, PALETTE['grass']!); // tile 1 (water: no category)
    put(1, PALETTE['water']!);
    remapDry(px, 32, 16, 2, new Map([[0, 'ground']]));
    const to = rgbRemap('ground').get((116 << 16) | (176 << 8) | 67)!;
    expect([...px.slice(0, 3)]).toEqual([(to >> 16) & 255, (to >> 8) & 255, to & 255]);
    expect([...px.slice(4, 7)]).toEqual(PALETTE['water']);
    expect([...px.slice(64, 67)]).toEqual(PALETTE['grass']);
  });

  it('a dry map has a thin wind and hardly a bird; the birds come back with the green', () => {
    const base = {
      inGame: true,
      map: 'farm',
      outdoor: true,
      season: 'spring',
      night: 0,
      weather: 'sunny',
      festival: false,
    };
    const green = chooseAmbience(base);
    const dry = chooseAmbience({ ...base, dry: true });
    expect(dry.wind).toBeGreaterThan(0);
    expect(green.wind).toBe(0);
    expect(dry.birds).toBeCloseTo(green.birds * DRY_BIRDS);
  });
});

describe('the first green', () => {
  it('never before day 5 and never without 5 shipped; fires once', () => {
    expect(checkFarmGreen(onDay(3, 9))).toBe(false); // the night of day 3: day 4 stays dry
    expect(checkFarmGreen(onDay(6, 4))).toBe(false);
    const s = onDay(4, 5); // the night of day 4: the farm wakes green on day 5
    expect(checkFarmGreen(s)).toBe(true);
    expect(s.stats[FARM_GREEN]).toBe(1);
    expect(checkFarmGreen(s)).toBe(false);
  });

  it('the morning after: a green farm, the note first, and Rosa with the tin and the journal', () => {
    const s = onDay(5, 5);
    s.stats['mail.welcome'] = 1;
    const sum = sleep(s);
    expect(s.time.day).toBe(6);
    expect(s.stats[FARM_GREEN]).toBe(1);
    expect(paletteOf(s, 'farm')).toBeNull();
    expect(arrangeNotes(sum.notes ?? [])[0]).toBe(valley.farmGreen.note);
    const letter = s.mail.list.find((l) => l.title === 'First green');
    expect(letter?.from).toBe('rosa');
    expect(letter?.gift?.item).toBe('ilse_tin');
    // the next night nothing fires again
    const again = sleep(s);
    expect(again.notes ?? []).not.toContain(valley.farmGreen.note);
    expect(s.mail.list.filter((l) => l.title === 'First green')).toHaveLength(1);
  });

  it('a day-3 player who already shipped 5 waits for day 5 (no beat on the settling-in days)', () => {
    const s = onDay(2, 5);
    sleep(s);
    expect(s.stats[FARM_GREEN] ?? 0).toBe(0);
    sleep(s); // night of day 3
    expect(s.stats[FARM_GREEN] ?? 0).toBe(0);
    sleep(s); // night of day 4
    expect(s.time.day).toBe(5);
    expect(s.stats[FARM_GREEN]).toBe(1);
  });

  it('the moment plays once, and only on a green farm', () => {
    const s = newState();
    expect(takeFirstGreenMoment(s)).toBe(false);
    s.stats[FARM_GREEN] = 1;
    expect(takeFirstGreenMoment(s)).toBe(true);
    expect(takeFirstGreenMoment(s)).toBe(false);
    expect(s.stats[GREEN_SEEN]).toBe(1);
  });

  it('taking the gift gives the tin and the journal together, or nothing when the bag is full', () => {
    const s = onDay(5, 5);
    sleep(s);
    const letter = s.mail.list.find((l) => l.title === 'First green')!;
    expect(giftLine(letter)).toBe("Enclosed: Ilse's Seed Tin and Ilse's Journal");
    const full = JSON.parse(JSON.stringify(s)) as GameState;
    for (let i = 0; i < full.inventory.slots.length; i++)
      if (!full.inventory.slots[i]) full.inventory.slots[i] = { item: 'stone', qty: 1 };
    const free = full.inventory.slots.findIndex((x) => x?.item === 'stone');
    full.inventory.slots[free] = null; // room for the tin, none for the journal
    expect(takeGift(full, letter.id)).toBe('full');
    expect(countItem(full, 'ilse_tin')).toBe(0);
    expect(takeGift(s, letter.id)).toBe('ok');
    expect(countItem(s, 'ilse_tin')).toBe(1);
    expect(countItem(s, 'ilse_journal')).toBe(1);
  });

  it('the tin and the journal are key items: never sold, shipped or given', () => {
    for (const id of ['ilse_tin', 'ilse_journal']) {
      expect(sellValue({ item: id })).toBe(0);
      expect(isShippable({ item: id })).toBe(false);
      expect(isGiftable({ item: id })).toBe(false);
    }
  });
});

describe('saves', () => {
  it('a new game knows the valley; its stats round-trip', () => {
    const s = newState();
    s.stats[FARM_GREEN] = 1;
    s.stats[GREEN_SEEN] = 1;
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.stats[FARM_GREEN]).toBe(1);
    expect(back.stats[GREEN_SEEN]).toBe(1);
    expect(back.stats['valley.on']).toBe(1);
  });

  it('an old save that shipped 5 is green (no moment); one that did not is dry', () => {
    const old = JSON.parse(JSON.stringify(newState()));
    delete old.stats['valley.on'];
    old.stats.shipped = 40;
    const a = migrate(old);
    expect(a.version).toBe(STATE_VERSION); // the valley's defaults need no bump of their own
    expect(a.stats[FARM_GREEN]).toBe(1);
    expect(a.stats[GREEN_SEEN]).toBe(1);
    const young = JSON.parse(JSON.stringify(newState()));
    delete young.stats['valley.on'];
    young.stats.shipped = 3;
    expect(migrate(young).stats[FARM_GREEN] ?? 0).toBe(0);
  });

  it('a new save that shipped 5 early is not greened by a reload (the rule waits for day 5)', () => {
    const s = onDay(2, 6);
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.stats[FARM_GREEN] ?? 0).toBe(0);
  });
});

describe("Rosa's letter", () => {
  it('fits the title card above New Game, with room to spare on the 200 x 400 canvas', () => {
    const L = letterLayout();
    expect(L.rows.length).toBeLessThanOrEqual(10);
    for (const r of L.rows) expect(measureText(r), r).toBeLessThanOrEqual(LETTER_CARD.w - 16);
    expect(LETTER_CARD.y).toBeGreaterThanOrEqual(146); // under the logo's ACRE (and its bob)
    expect(L.buttonY + TITLE_BUTTON_H).toBeLessThanOrEqual(340); // above the field at the bottom
  });

  it("the first green's banner is two lines that fit its slot", () => {
    const [title, line] = valley.farmGreen.banner.split('\n');
    expect(title).toBe('FIRST GREEN');
    expect(measureText(title!, 2)).toBeLessThanOrEqual(190);
    expect(measureText(line!)).toBeLessThanOrEqual(190);
  });

  it('wraps on words and keeps its line breaks', () => {
    expect(wrapText('aaa bbb\nccc', 1000)).toEqual(['aaa bbb', 'ccc']);
    expect(wrapText('aaa bbb', measureText('aaa'))).toEqual(['aaa', 'bbb']);
  });

  it('is kept in the mailbox, read, from day 3 (never on the guided days)', () => {
    const s = newState();
    sleep(s); // the morning of day 2: the guide's mail step reads the mailbox
    expect(s.mail.list.some((l) => l.title === valley.letter.title)).toBe(false);
    sleep(s); // day 3
    const kept = s.mail.list.filter((l) => l.title === valley.letter.title);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.read).toBe(true);
    expect(kept[0]!.day).toBe(1);
    sleep(s);
    expect(s.mail.list.filter((l) => l.title === valley.letter.title)).toHaveLength(1);
  });

  it('the welcome strip and the new letters fit', () => {
    // two rows by design: no orphaned "yours." on an SE or iPhone 13 (critic, M1 review 2)
    expect(tutorial.welcome).toBe("You came! I'm Rosa.\nThe farm's yours.");
    expect(wrapText(tutorial.welcome, 158)).toEqual(["You came! I'm Rosa.", "The farm's yours."]);
    // the strip wraps at 158 px (ui/CoachMarks.ts) into at most two rows, and is shorter than the old line
    expect(wrapText(tutorial.welcome, 158).length).toBeLessThanOrEqual(2);
    expect(measureText(tutorial.welcome)).toBeLessThan(
      measureText("Hi, I'm Rosa! This old farm is yours now."),
    );
    for (const id of ['first_green', 'welcome', 'clay_intro']) {
      const l = mail.letters.find((x) => x.id === id)!;
      expect(measureText(l.text), id).toBeLessThanOrEqual(184 * 8);
    }
  });
});

describe('villager lines that fit the valley', () => {
  const tiers = ['stranger', 'friend', 'close', 'rain'] as const;

  it('every villager has 3-4 lines about their loss while their place is unrestored', () => {
    // a returning villager (Senna) is only in the valley once their place is restored: no dry lines to say
    for (const [id, def] of Object.entries(npcs).filter(([, d]) => !d.arrives)) {
      const dry = new Set(
        tiers.flatMap((t) =>
          def.lines[t]
            .filter((l) => typeof l !== 'string' && l.when.max !== undefined && l.when.place)
            .map(lineText),
        ),
      );
      const rain = def.lines.rain.filter((l) => typeof l !== 'string' && l.when.max !== undefined);
      expect(dry.size - rain.length, id).toBeGreaterThanOrEqual(3);
      expect(dry.size - rain.length, id).toBeLessThanOrEqual(5);
    }
  });

  it('a group with no line for today falls back to the tier below', () => {
    const s = newState();
    s.friends['orin'] = { points: 0, talkedDay: 0, giftedDay: 0 };
    // Orin's stranger lines without the forge: never "Mind the sparks." (the forge is cold)
    for (let d = 1; d <= 28; d++) {
      s.time.day = d;
      expect(lineFor(s, 'orin')).not.toBe('Mind the sparks.');
    }
    // a group whose only lines are conditioned falls back
    expect(linesNow(s, [{ text: 'x', when: { place: 'forge', min: 3 } }])).toEqual([]);
    s.stats['place.forge'] = 3;
    expect(linesNow(s, [{ text: 'x', when: { place: 'forge', min: 3 } }])).toEqual(['x']);
  });

  it('events: a variant per valley state, and seeing one sees both', () => {
    const s = newState();
    s.friends['rosa'] = { points: POINTS_PER_HEART * 5, talkedDay: 0, giftedDay: 0 };
    for (const ev of ['soil', 'orchard']) s.stats[`event.rosa.${ev}`] = 1;
    const dry = pendingEvent(s, 'rosa');
    expect(dry?.id).toBe('harvest');
    expect(dry?.lines.join(' ')).not.toMatch(/whole valley is talking/);
    s.stats['place.orchard'] = 3;
    expect(pendingEvent(s, 'rosa')?.lines.join(' ')).toMatch(/whole valley is talking/);
    s.stats['place.orchard'] = 0;
    expect(completeEvent(s, 'rosa').ok).toBe(true);
    s.stats['place.orchard'] = 3;
    expect(pendingEvent(s, 'rosa')).toBeNull();
  });

  it('nothing reachable calls the valley thriving while its place is unrestored', () => {
    const banned = [/booming/i, /whole valley is talking/i, /talk of (the )?town/i, /thriving/i];
    const s = newState();
    const said: string[] = [];
    for (const green of [0, 1]) {
      s.stats[FARM_GREEN] = green;
      for (const def of Object.values(npcs)) {
        for (const t of tiers) said.push(...linesNow(s, def.lines[t]));
        for (const ev of def.events ?? [])
          if (valleyHolds(s, ev.when)) said.push(ev.title, ...ev.lines);
      }
    }
    for (const l of mail.letters) said.push(l.title, l.text);
    said.push(JSON.stringify(tutorial), valley.letter.text);
    for (const line of said) for (const re of banned) expect(line, line).not.toMatch(re);
  });

  it('every line and event line fits the dialogue box', () => {
    for (const [id, def] of Object.entries(npcs)) {
      for (const t of tiers)
        for (const l of def.lines[t])
          expect(measureText(`"${lineText(l)}"`), `${id}: ${lineText(l)}`).toBeLessThanOrEqual(
            184 * 3,
          );
      for (const ev of def.events ?? [])
        for (const l of ev.lines)
          expect(measureText(`"${l}"`), `${id}: ${l}`).toBeLessThanOrEqual(184 * 3);
    }
  });
});
