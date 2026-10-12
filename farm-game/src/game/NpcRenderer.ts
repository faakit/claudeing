import Phaser from 'phaser';
import { SHADOW_TEXTURE } from '../art/placeholders';
import { npcFrame, npcTexture } from '../art/manifest';
import type { Direction } from '../state/GameState';
import { TILE_SIZE } from '../config';
import { npcs } from '../data';
import type { GameState } from '../state/GameState';
import { getState } from '../state/store';
import { canChat } from '../systems/friendship';
import type { CollisionGrid } from '../systems/movement';
import { npcLocation, npcMaps } from '../systems/npcs';
import { findPath } from '../systems/pathfind';
import type { TileCoord } from '../systems/world';
import { Label } from '../ui/font';
import { CH as C } from '../ui/theme';

interface Shown {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  marker: Label;
  /** Where they stand on this map right now (null: elsewhere, at home, or walking). */
  at: { tx: number; ty: number } | null;
  /** Where the schedule wants them on this map (null: off this map). */
  want: TileCoord | null;
  /** A walk under way: the tiles, the step reached (fractional), and whether it ends off the map (a door/edge). */
  walk: { path: TileCoord[]; pos: number; leaves: boolean } | null;
  /** Shown on this map (standing or walking). */
  here: boolean;
}

/**
 * What the renderer needs from its scene to move villagers believably: the walk grid, the ways on and off the map
 * (doors and edge exits), and whether a tile is on screen.
 */
export interface NpcWorld {
  grid(): CollisionGrid;
  exits(): readonly TileCoord[];
  inView(tx: number, ty: number): boolean;
}

/** A villager's walking pace, tiles per second (a stroll, a little under the farmer's). */
const WALK_TPS = 3;

const px = (tx: number): number => tx * TILE_SIZE + TILE_SIZE / 2;
const feet = (ty: number): number => ty * TILE_SIZE + TILE_SIZE - 2;

/**
 * Draws the villagers who spend time on one map. They follow a daily schedule (see `npcLocation`), stand still
 * where they are, and block the tile they stand on. `sync` returns true when someone arrived or left.
 *
 * Owner: "sometimes the NPCs appear from nowhere or just disappear". A villager never pops in or out on screen:
 * a schedule change on this map is walked; one that takes them off the map walks them to the nearest door or edge
 * exit, where they go; one that brings them here starts them at the exit nearest their spot. When no walk exists,
 * the change waits until both ends are off screen. Only the first placement (the scene opening behind its wipe)
 * and `instant` syncs (the screen covered) place them at once.
 */
export class NpcRenderer {
  private shown = new Map<string, Shown>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapId: string,
    private readonly world: NpcWorld | null = null,
  ) {
    for (const [id, def] of Object.entries(npcs)) {
      if (!npcMaps(id).includes(mapId)) continue;
      const shadow = scene.add.image(0, 0, SHADOW_TEXTURE).setVisible(false);
      const sprite = scene.add
        .sprite(0, 0, npcTexture(id), npcFrame(id, def.facing, 0))
        .setOrigin(0.5, 1)
        .setVisible(false);
      this.idle(sprite, id, def.facing);
      // A bobbing "!" says there is something new to hear today.
      const marker = new Label(scene, 0, 0, '!', { align: 'center', color: C.gold })
        .setDepth(9000)
        .setVisible(false);
      this.shown.set(id, { sprite, shadow, marker, at: null, want: null, walk: null, here: false });
    }
  }

  /**
   * Move villagers toward where the schedule puts them now, and refresh the "!" markers. `instant` places them at
   * once (the first sync of a scene, or the screen covered). Returns true when the tiles they block changed.
   */
  sync(state: GameState, playerTile?: { tx: number; ty: number }, instant = false): boolean {
    let moved = false;
    for (const [id, s] of this.shown) {
      const spot = npcLocation(id, state.time.minutes, state);
      const here = spot && spot.map === this.mapId ? spot : null;
      const want = here ? { tx: here.tx, ty: here.ty } : null;
      if (this.same(want, s.want) && !instant) {
        s.marker.setVisible(s.here && !!s.at && canChat(state, id));
        continue;
      }
      const blocked = want && playerTile && playerTile.tx === want.tx && playerTile.ty === want.ty;
      if (blocked) continue; // never step onto the player; try again next minute
      s.want = want;
      if (instant || !this.world) moved = this.place(s, want) || moved;
      else moved = this.head(s, want) || moved;
      s.marker.setVisible(s.here && !!s.at && canChat(state, id));
    }
    return moved;
  }

  /** Stand a villager on a tile at once (or take them off the map). */
  private place(s: Shown, to: TileCoord | null): boolean {
    const was = s.at;
    s.walk = null;
    s.at = to ? { ...to } : null;
    s.here = !!to;
    if (to) this.put(s, px(to.tx), feet(to.ty), true);
    s.sprite.setVisible(s.here).setAlpha(1);
    s.shadow.setVisible(s.here);
    if (!s.here) s.marker.setVisible(false);
    return !this.same(was, s.at);
  }

  /**
   * Start the way to `to` (null: off this map): a walk when one exists, else a change made only off screen.
   * Returns true when the blocked tiles changed now.
   */
  private head(s: Shown, to: TileCoord | null): boolean {
    const w = this.world!;
    const from = s.walk ? this.walkTile(s) : s.at;
    if (!s.here || !from) {
      if (!to) return this.place(s, null); // not here, not wanted here: nothing shows
      // arriving where nobody sees: simply there
      if (!w.inView(to.tx, to.ty)) return this.place(s, to);
      // arriving in view: in from the nearest tile out of view (just past the screen's edge), so the villager is
      // there about as soon as the schedule says (the guided start meets Rosa at 7:00), else from a gate
      const path = this.pathOffView(to) ?? this.pathToExit(to);
      if (path) {
        const inward = [...path].reverse();
        let from0 = 0;
        for (let i = 0; i < inward.length; i++)
          if (!w.inView(inward[i]!.tx, inward[i]!.ty)) from0 = i;
        s.walk = { path: inward.slice(from0), pos: 0, leaves: false };
        s.at = null;
        s.here = true;
        const first = s.walk.path[0]!;
        this.put(s, px(first.tx), feet(first.ty), true);
        s.sprite.setVisible(true).setAlpha(1);
        s.shadow.setVisible(true);
        return false;
      }
      return w.inView(to.tx, to.ty) ? false : this.place(s, to); // no way in: only where nobody sees it
    }
    // both ends out of view: the change is made at once, unseen
    if (!w.inView(from.tx, from.ty) && (!to || !w.inView(to.tx, to.ty))) return this.place(s, to);
    if (to) {
      const path = this.pathBetween(from, to);
      if (path && path.length > 1) {
        const had = !!s.at;
        s.walk = { path, pos: 0, leaves: false };
        s.at = null;
        return had;
      }
      if (path) return this.place(s, to);
    } else {
      // leaving: off the nearest screen edge (gone once out of view), else through a gate
      const path = this.pathOffView(from) ?? this.pathToExit(from);
      if (path) {
        const had = !!s.at;
        s.walk = { path, pos: 0, leaves: true };
        s.at = null;
        return had;
      }
    }
    // no walk: change only with both ends off screen (tried again each frame)
    const seen = w.inView(from.tx, from.ty) || (to ? w.inView(to.tx, to.ty) : false);
    return seen ? false : this.place(s, to);
  }

  /** The tile a walker is on now. */
  private walkTile(s: Shown): TileCoord {
    const w = s.walk!;
    return w.path[Math.min(w.path.length - 1, Math.round(w.pos))]!;
  }

  /** The walk grid without the villagers' own tiles (they only step around the world, not each other). */
  private gridFree(): CollisionGrid {
    const g = this.world!.grid();
    const free = { ...g, blocked: Uint8Array.from(g.blocked) };
    for (const o of this.shown.values()) if (o.at) free.blocked[o.at.ty * g.width + o.at.tx] = 0;
    return free;
  }

  private pathBetween(a: TileCoord, b: TileCoord): TileCoord[] | null {
    return findPath(this.gridFree(), a, [b], { maxNodes: 6000 });
  }

  /** The walk from a tile to the nearest tile out of view (where a change is never seen). */
  private pathOffView(from: TileCoord): TileCoord[] | null {
    const w = this.world!;
    const g = this.gridFree();
    const goals: TileCoord[] = [];
    for (let ty = 0; ty < g.height; ty++)
      for (let tx = 0; tx < g.width; tx++)
        if (!g.blocked[ty * g.width + tx] && !w.inView(tx, ty)) goals.push({ tx, ty });
    return goals.length ? findPath(g, from, goals, { maxNodes: 6000 }) : null;
  }

  private pathToExit(from: TileCoord): TileCoord[] | null {
    const exits = this.world!.exits();
    if (!exits.length) return null;
    const g = this.gridFree();
    for (const e of exits)
      if (e.tx >= 0 && e.ty >= 0 && e.tx < g.width && e.ty < g.height)
        g.blocked[e.ty * g.width + e.tx] = 0;
    return findPath(g, from, exits, { maxNodes: 6000 });
  }

  private put(s: Shown, x: number, y: number, settle: boolean): void {
    s.sprite.setPosition(x, y).setDepth(10 + y);
    s.shadow.setPosition(x, y - 2).setDepth(9 + y);
    if (!settle) return;
    s.marker.setPosition(x, y - 36);
    this.scene.tweens.killTweensOf(s.marker);
    if (!getState().settings.reduceMotion)
      this.scene.tweens.add({
        targets: s.marker,
        y: y - 39,
        duration: 450,
        yoyo: true,
        repeat: -1,
      });
  }

  /**
   * Walk the walkers a frame on (`dt` ms) and make any change that waited for nobody to see it. Returns true when
   * the blocked tiles changed (someone arrived, or a waiting change was made).
   */
  update(dt: number): boolean {
    let moved = false;
    for (const [id, s] of this.shown) {
      if (!s.walk) {
        const pending = s.here ? !s.at || !this.same(s.at, s.want) : !!s.want;
        if (pending && this.world) moved = this.head(s, s.want) || moved;
        continue;
      }
      const w = s.walk;
      w.pos = Math.min(w.path.length - 1, w.pos + (WALK_TPS * dt) / 1000);
      const i = Math.floor(w.pos);
      const a = w.path[i]!;
      const b = w.path[Math.min(w.path.length - 1, i + 1)]!;
      const f = w.pos - i;
      const x = px(a.tx) + (px(b.tx) - px(a.tx)) * f;
      const y = feet(a.ty) + (feet(b.ty) - feet(a.ty)) * f;
      // a step bob (the villagers have no walk frames): 1 px up on every other half tile
      const bob = getState().settings.reduceMotion ? 0 : Math.floor(w.pos * 2) % 2;
      this.put(s, Math.round(x), Math.round(y) - bob, false);
      const dir: Direction =
        b.tx > a.tx ? 'right' : b.tx < a.tx ? 'left' : b.ty < a.ty ? 'up' : 'down';
      this.idle(s.sprite, id, dir);
      s.marker.setVisible(false);
      // a villager leaving is gone once out of view (no long unseen walk to the gate)
      const here = this.walkTile(s);
      if (w.leaves && this.world && !this.world.inView(here.tx, here.ty)) w.pos = w.path.length - 1;
      if (w.pos < w.path.length - 1) continue;
      const end = w.path[w.path.length - 1]!;
      s.walk = null;
      if (w.leaves) {
        // through the door or off the edge: gone
        s.here = false;
        s.at = null;
        s.sprite.setVisible(false);
        s.shadow.setVisible(false);
        continue;
      }
      s.at = { ...end };
      this.put(s, px(end.tx), feet(end.ty), true);
      this.idle(s.sprite, id, this.same(s.at, s.want) ? (npcs[id]?.facing ?? 'down') : dir);
      s.marker.setVisible(canChat(getState(), id));
      moved = true;
    }
    return moved;
  }

  private same(a: TileCoord | null, b: TileCoord | null): boolean {
    return (a?.tx ?? -1) === (b?.tx ?? -1) && (a?.ty ?? -1) === (b?.ty ?? -1);
  }

  /** Villagers drawn on this map now, and where (debug and e2e: nobody pops in or out on screen). */
  debug(): { id: string; visible: boolean; x: number; y: number; walking: boolean }[] {
    return [...this.shown].map(([id, s]) => ({
      id,
      visible: s.sprite.visible,
      x: s.sprite.x,
      y: s.sprite.y,
      walking: !!s.walk,
    }));
  }

  /** Tiles the villagers occupy right now (for the collision grid). */
  tiles(): [number, number][] {
    return [...this.shown.values()].filter((s) => s.at).map((s) => [s.at!.tx, s.at!.ty]);
  }

  /** Which villager is on a tile right now (standing, or walking through it), if any. */
  at(tx: number, ty: number): string | null {
    for (const [id, s] of this.shown) {
      const t = s.at ?? (s.walk ? this.walkTile(s) : null);
      if (t && t.tx === tx && t.ty === ty) return id;
    }
    return null;
  }

  /** Where each villager shown on this map is now (a walker by the tile it is crossing), for the guided start. */
  positions(): { id: string; tx: number; ty: number }[] {
    const out: { id: string; tx: number; ty: number }[] = [];
    for (const [id, s] of this.shown) {
      const t = s.at ?? (s.walk && s.here ? this.walkTile(s) : null);
      if (t) out.push({ id, tx: t.tx, ty: t.ty });
    }
    return out;
  }

  /** Turn a villager toward the player who is talking to them. */
  faceToward(id: string, px0: number, py0: number): void {
    const s = this.shown.get(id);
    if (!s?.at) return;
    const dx = px0 - px(s.at.tx);
    const dy = py0 - (s.at.ty * TILE_SIZE + TILE_SIZE / 2);
    const dir: Direction =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    this.idle(s.sprite, id, dir);
  }

  /** Two-frame idle facing `dir` (a still frame with reduced motion). */
  private idle(sprite: Phaser.GameObjects.Sprite, id: string, dir: Direction): void {
    if (getState().settings.reduceMotion) {
      sprite.anims.stop();
      sprite.setFrame(npcFrame(id, dir, 0));
    } else
      sprite.anims.play({ key: `${npcTexture(id)}_idle_${dir}`, startFrame: id.length % 2 }, true);
  }

  destroy(): void {
    for (const s of this.shown.values()) {
      this.scene.tweens.killTweensOf(s.sprite);
      this.scene.tweens.killTweensOf(s.marker);
      s.sprite.destroy();
      s.shadow.destroy();
      s.marker.destroy();
    }
    this.shown.clear();
  }
}
