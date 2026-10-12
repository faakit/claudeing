/**
 * One act per short Action press, whatever the frame rate (coordinator ruling after the dry-year-2 code review).
 *
 * Each press of Action has an id (`InputHub.pressAction`), and a press acts once. Only a key the system itself
 * reports as held (its auto-repeat keydowns, `InputHub.actionRepeats`) repeats, as Space does on desktop. Frame
 * timing plays no part: on a loaded machine a 60 ms press could be seen held past the 200 ms Action lock (slow
 * frames, a key release delivered late), and the one press foraged two goods. A touch tap on Action (a 70 ms pulse)
 * never repeats. Pure.
 */
export class ActionGate {
  /** The press that last acted (-1: none). */
  private used = -1;

  /** May this press act now? A new press always may; the same press only while it is a held key's repeat. */
  may(press: number, repeats: boolean): boolean {
    return press !== this.used || repeats;
  }

  /** This press acted (or tried to). */
  acted(press: number): void {
    this.used = press;
  }
}
