import type { Reaction } from '../../systems/friendship';

/** Gift list hint for a reaction the player has already seen. */
export const KNOWN_TEXT: Record<Reaction, string> = {
  love: 'Loves it!',
  like: 'Likes it',
  neutral: 'Not fussed',
  dislike: 'Dislikes it',
};

/** The line under an item in the gift list. Pure so a test can prove it fits. */
export const giftSub = (have: number, known: Reaction | null): string =>
  `Have ${have}  ${known ? KNOWN_TEXT[known] : 'Not tried yet'}`;
