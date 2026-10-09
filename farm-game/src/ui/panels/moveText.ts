/** The Move sheet's line: what comes along when an occupied building is moved. Pure, so tests can fit it. */
export const moveText = (occupants: string | null): string =>
  occupants
    ? `It goes into your bag with ${occupants}. Place it again and everything comes back.`
    : 'It goes into your bag. Place it again anywhere on your land.';
