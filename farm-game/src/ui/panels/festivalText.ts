/** "place 2" or "no podium": how a score would rank. */
export const placeText = (place: number): string => (place <= 3 ? `place ${place}` : 'no podium');
