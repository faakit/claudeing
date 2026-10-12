import Phaser from 'phaser';
import {
  ATLAS_FILES,
  LETTER_SLICE,
  SHEET_PIECES,
  SHEET_SLICE,
  letterPieceKey,
  sheetPieceKey,
  type SheetPiece,
} from '../art/manifest';
import { SKIN } from './theme';

/**
 * The menu sheet skin (art round 5): a parchment sheet in a walnut frame with brass corner caps, from 9-slice
 * pieces in the ui atlas (art-src/tools/uisheet.py, Flow `ui1` b). Edges and the centre TILE, never stretch, so the
 * wood grain keeps whole pixels at any sheet size.
 *
 * A texture of the sheet at w x h, composed once per size (a canvas, so one image and one draw call per open
 * sheet). Null when the pieces are missing (the plum skin, or no ui atlas): the caller draws the old panel.
 */
export function sheetTexture(scene: Phaser.Scene, w: number, h: number): string | null {
  if (SKIN !== 'walnut') return null;
  return nineSlice(scene, 'ui_sheet', sheetPieceKey, SHEET_SLICE, w, h);
}

/** Rosa's letter paper at w x h (Dry Year, art-src/tools/letterpaper.py), or null when its pieces are missing. */
export function letterTexture(scene: Phaser.Scene, w: number, h: number): string | null {
  return nineSlice(scene, 'ui_letter', letterPieceKey, LETTER_SLICE, w, h);
}

type Slice = { left: number; right: number; top: number; bottom: number };

/** Compose 9-slice pieces into one canvas texture `<prefix>_<w>x<h>`: edges and centre tile, corners as they are. */
function nineSlice(
  scene: Phaser.Scene,
  prefix: string,
  pieceKey: (p: SheetPiece) => string,
  slice: Slice,
  w: number,
  h: number,
): string | null {
  const atlasKey = ATLAS_FILES.ui.key;
  if (!scene.textures.exists(atlasKey)) return null;
  const atlas = scene.textures.get(atlasKey);
  if (!SHEET_PIECES.every((p) => atlas.has(pieceKey(p)))) return null;
  const id = `${prefix}_${w}x${h}`;
  if (scene.textures.exists(id)) return id;
  const L = slice.left;
  const R = slice.right;
  const T = slice.top;
  const B = slice.bottom;
  if (w < L + R || h < T + B) return null;
  const canvas = scene.textures.createCanvas(id, w, h);
  if (!canvas) return null;
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;
  const img = atlas.getSourceImage() as CanvasImageSource;
  const tile = (p: SheetPiece, x: number, y: number, rw: number, rh: number) => {
    const f = atlas.get(pieceKey(p));
    for (let yy = 0; yy < rh; yy += f.cutHeight)
      for (let xx = 0; xx < rw; xx += f.cutWidth) {
        const cw = Math.min(f.cutWidth, rw - xx);
        const ch = Math.min(f.cutHeight, rh - yy);
        ctx.drawImage(img, f.cutX, f.cutY, cw, ch, x + xx, y + yy, cw, ch);
      }
  };
  tile('c', L, T, w - L - R, h - T - B);
  tile('t', L, 0, w - L - R, T);
  tile('b', L, h - B, w - L - R, B);
  tile('l', 0, T, L, h - T - B);
  tile('r', w - R, T, R, h - T - B);
  tile('tl', 0, 0, L, T);
  tile('tr', w - R, 0, R, T);
  tile('bl', 0, h - B, L, B);
  tile('br', w - R, h - B, R, B);
  canvas.refresh();
  return id;
}
