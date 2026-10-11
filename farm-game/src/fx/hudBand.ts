/**
 * When the HUD's goal or level banner is on screen (performance.now ms), so world text can keep clear of it. The
 * HUD sets it; effects read it. No Phaser, no state.
 */
let until = 0;

export const showBanner = (ms: number): void => {
  until = performance.now() + ms;
};

export const bannerShowing = (): boolean => performance.now() < until;
