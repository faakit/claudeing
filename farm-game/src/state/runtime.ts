/**
 * Transient, non-saved flags shared by scenes. Anything here is derived UI/flow state,
 * never game rules, so it never needs saving.
 */
export const runtime = {
  /** Open modal panels; the world and the clock freeze while any are open. */
  modals: 0,
  /** A scripted flow (sleep, results) owns the screen. */
  busy: false,
  /** False on the title screen, so autosave never writes a half-initialised game. */
  inGame: false,
  get blocked(): boolean {
    return this.modals > 0 || this.busy;
  },
};
