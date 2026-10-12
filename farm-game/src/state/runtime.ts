/**
 * Transient, non-saved flags shared by scenes. Anything here is derived UI/flow state,
 * never game rules, so it never needs saving.
 */
export const runtime = {
  /** Open modal panels; the world and the clock freeze while any are open. */
  modals: 0,
  /** A scripted flow (sleep, results) owns the screen. */
  busy: false,
  /** The app is in the background: the world and the clock stay frozen even if frames still arrive. */
  suspended: false,
  /** False on the title screen, so autosave never writes a half-initialised game. */
  inGame: false,
  /** A guided-start coach mark is showing: the idle hint and the goal arrow stay quiet. */
  coaching: false,
  /** The first green's dissolve is playing: the ambience stays dry until the green reaches the edges. */
  valleyReveal: false,
  /** A painted row is being worked: Action on a channel digs on, it never fills one in (mechanics/channels.ts). */
  paintWork: false,
  /** From a cast until the fishing sheet closes: the farmer holds the rod out (never a tool swing frame). */
  fishing: false,
  /**
   * The player picked the hotbar slot by hand (a tap, a swipe step, the ring, a key, the wheel) since the last
   * thing Action did; a selection Action moved itself (auto tool, `followChoice`) is not. The HUD names a hand
   * pick only, so a painted row's tool changes do not pop a name plate on every tile.
   */
  handPick: false,
  get blocked(): boolean {
    return this.modals > 0 || this.busy || this.suspended;
  },
};
