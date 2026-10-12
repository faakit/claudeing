import { valley } from '../data';
import { wrapText } from './fontMetrics';

/**
 * Rosa's letter on the title screen at a first launch (no save): a parchment card under the logo with New Game
 * beneath it, so reading it costs no time the player was not already spending there. Pure layout, so a test can
 * prove the card and the button fit the 200 x 400 canvas (and so the e2e and the critic's bot can find New Game).
 */
export const LETTER_CARD = { x: 8, y: 148, w: 184 } as const;
/**
 * The logo above it: TINY and ACRE at 6x, each word's glyph rows 1-7 (6 to 48 px under its y), carved 4 px deep and
 * bobbing 3 px down. Its lowest pixel (ACRE's carving at the bottom of the bob) stays above the card: the card is
 * drawn over the logo, so a deeper logo would sink under the paper.
 */
export const LOGO = { y: [47, 93], scale: 6, depth: 4, bob: 3 } as const;
/** The logo's lowest drawn row, at the bottom of its bob. */
export const logoBottom = (): number => LOGO.y[1] + 8 * LOGO.scale + LOGO.depth + LOGO.bob;
/** Text inset inside the card, and the bitmap font's row pitch. */
export const LETTER_PAD = 8;
export const LETTER_ROW = 11;
/** Space between the card's bottom and New Game. */
export const LETTER_GAP = 10;
/** New Game's height on the title (the same 30 px button as with a save). */
export const TITLE_BUTTON_H = 30;
/** The analytics question's text width on the title, where the buttons go (only when a provider asks). */
export const CONSENT_TEXT_W = 180;

export interface LetterLayout {
  rows: string[];
  /** Card height (text rows, the signature row and the padding). */
  h: number;
  /** Where the signature sits (right-aligned at `signX`). */
  signY: number;
  signX: number;
  /** Top of New Game under the card. */
  buttonY: number;
}

export function letterLayout(): LetterLayout {
  const rows = wrapText(valley.letter.text, LETTER_CARD.w - LETTER_PAD * 2);
  const textH = rows.length * LETTER_ROW;
  const signY = LETTER_CARD.y + LETTER_PAD + textH + 2;
  const h = LETTER_PAD + textH + 2 + LETTER_ROW + LETTER_PAD;
  return {
    rows,
    h,
    signY,
    signX: LETTER_CARD.x + LETTER_CARD.w - LETTER_PAD,
    buttonY: LETTER_CARD.y + h + LETTER_GAP,
  };
}
