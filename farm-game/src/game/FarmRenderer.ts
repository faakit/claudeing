import Phaser from 'phaser';
import { CROPS_TEXTURE, cropFrame, SOIL_TEXTURE, WEED_TEXTURE } from '../art/gameArt';
import { TILE_SIZE } from '../config';
import type { GameState } from '../state/GameState';
import { parseKey } from '../systems/farming';
import { popWhole } from '../fx/pop';
import { getState } from '../state/store';

interface Cell {
  soil: Phaser.GameObjects.Image;
  crop?: Phaser.GameObjects.Image;
  cropKey?: string;
  watered: boolean;
}

/** Draws farm state (soil, crops, weeds) as sprites. Reads state, never edits it. */
export class FarmRenderer {
  private cells = new Map<string, Cell>();
  private weeds = new Map<string, Phaser.GameObjects.Image>();
  /** Crops leaning from a brush right now. */
  private leaning = new Set<Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  sync(state: GameState, animate: boolean): void {
    const live = new Set<string>();
    for (const [key, soil] of Object.entries(state.farm.tiles)) {
      live.add(key);
      const [tx, ty] = parseKey(key);
      const cx = tx * TILE_SIZE + TILE_SIZE / 2;
      let cell = this.cells.get(key);
      const texture = soil.watered ? SOIL_TEXTURE.watered : SOIL_TEXTURE.tilled;
      if (!cell) {
        const img = this.scene.add.image(cx, ty * TILE_SIZE + TILE_SIZE / 2, texture).setDepth(0.5);
        if (animate) this.pop(img);
        cell = { soil: img, watered: soil.watered };
        this.cells.set(key, cell);
      } else if (cell.watered !== soil.watered) {
        cell.soil.setTexture(texture);
        cell.watered = soil.watered;
      }

      const want = soil.crop ? cropFrame(soil.crop.cropId, soil.crop.stage) : undefined;
      if (want !== cell.cropKey) {
        if (want) {
          if (!cell.crop) {
            cell.crop = this.scene.add
              .image(cx, (ty + 1) * TILE_SIZE - 1, CROPS_TEXTURE, want)
              .setOrigin(0.5, 1)
              .setDepth(10 + (ty + 1) * TILE_SIZE - 2);
          } else {
            cell.crop.setFrame(want);
          }
          if (animate) this.pop(cell.crop);
        } else {
          cell.crop?.destroy();
          cell.crop = undefined;
        }
        cell.cropKey = want;
      }
    }
    for (const [key, cell] of this.cells) {
      if (live.has(key)) continue;
      cell.soil.destroy();
      cell.crop?.destroy();
      this.cells.delete(key);
    }

    const weedKeys = new Set(Object.keys(state.farm.weeds));
    for (const key of weedKeys) {
      if (this.weeds.has(key)) continue;
      const [tx, ty] = parseKey(key);
      const img = this.scene.add
        .image(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, WEED_TEXTURE)
        .setDepth(0.6);
      if (animate) this.pop(img);
      this.weeds.set(key, img);
    }
    for (const [key, img] of this.weeds) {
      if (weedKeys.has(key)) continue;
      img.destroy();
      this.weeds.delete(key);
    }
  }

  /**
   * The farmer walks through a crop: it leans 1 px the way he goes and springs back (whole pixels; Calm: still).
   */
  brush(tx: number, ty: number, dx: number): void {
    if (getState().settings.reduceMotion) return;
    const cell = this.cells.get(`${tx},${ty}`);
    const c = cell?.crop;
    const plain = cell?.cropKey;
    if (!c || !plain || this.leaning.has(c)) return;
    this.leaning.add(c);
    const done = () => this.leaning.delete(c);
    // Drawn lean frames (art round 4, stage 2 and up): lean away 120 ms, plain 80, the other way 80, rest.
    const away = `${plain}_lean_${dx < 0 ? 'l' : 'r'}`;
    const back = `${plain}_lean_${dx < 0 ? 'r' : 'l'}`;
    const tex = this.scene.textures.get(CROPS_TEXTURE);
    if (tex.has(away) && tex.has(back)) {
      const set = (f: string) => c.active && cell.cropKey === plain && c.setFrame(f);
      set(away);
      this.scene.time.delayedCall(120, () => set(plain));
      this.scene.time.delayedCall(200, () => set(back));
      this.scene.time.delayedCall(280, () => {
        set(plain);
        done();
      });
      return;
    }
    // Until they exist: the whole plant nudges 1 px and springs back.
    const x0 = tx * TILE_SIZE + TILE_SIZE / 2;
    c.setX(x0 + dx);
    this.scene.time.delayedCall(110, () => c.active && c.setX(x0 - dx));
    this.scene.time.delayedCall(170, () => {
      if (c.active) c.setX(x0);
      done();
    });
  }

  /** World-space center of a tile, for effects. */
  static center(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  }

  /** A new tile or crop stage arrives: a whole-pixel squash for crops, a fade for flat soil (fx/pop.ts). */
  private pop(img: Phaser.GameObjects.Image): void {
    popWhole(this.scene, img);
  }

  destroy(): void {
    for (const c of this.cells.values()) {
      c.soil.destroy();
      c.crop?.destroy();
    }
    for (const w of this.weeds.values()) w.destroy();
    this.cells.clear();
    this.weeds.clear();
  }
}
