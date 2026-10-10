import type { Direction } from '../state/GameState';

export interface TapPoint {
  x: number;
  y: number;
}
export interface InputEvents {
  action: undefined;
  interact: undefined;
  /** A still touch on the world lifted (logical screen coordinates): commit a tap. */
  tap: TapPoint;
  /** A touch on the world has been still for a moment: preview what a tap there would do. */
  tapPreview: TapPoint;
  /** The previewed touch turned into a drag (the stick) or left the world: drop the preview. */
  tapCancel: undefined;
  /**
   * Painting from Action (held still, then dragged): the path so far, live. `path` is one direction per tile
   * from the farmer (a path may turn corners, round 3); `dir` is the current leg's direction and `tiles` the
   * path's length. Null direction / 0 tiles = armed but nothing chosen yet.
   */
  paintLine: { dir: Direction | null; tiles: number; path?: Direction[] };
  /** The painting finger lifted: work the line (`commit`), or drop it. */
  paintEnd: { commit: boolean };
  /** Hotbar slot picked by number key (0-based). */
  slot: number;
  /** Cycle the hotbar by +1 / -1 (wheel, Tab). */
  cycle: number;
  menu: undefined;
  /** Enter: confirm the primary action of the open dialog. */
  confirm: undefined;
}

type Listener<K extends keyof InputEvents> = (payload: InputEvents[K]) => void;

/**
 * Phaser-free meeting point for every input source. Sources write into it; scenes
 * read `direction` each frame and subscribe to one-shot events.
 */
export class InputHub {
  private keys: Direction[] = [];
  private stick: Direction | null = null;
  /**
   * True while Space is held (tools repeat, for desktop testing), or for a brief moment after a tap on the
   * Action button (one use: holding Action on touch never repeats).
   */
  actionHeld = false;
  /**
   * The hotbar slot Action would use right now (auto tool may pick another than the selected one), set
   * by the world each frame so the Action button can show it. Null when Action has nothing to do.
   */
  actionSlot: number | null = null;
  /** The stick is pushed less than halfway (the two-speed stick walks at half speed then). */
  stickSlow = false;
  private listeners = new Map<keyof InputEvents, Set<Listener<never>>>();

  /** Joystick wins over keyboard; among keys the most recently pressed wins. */
  get direction(): Direction | null {
    return this.stick ?? this.keys[this.keys.length - 1] ?? null;
  }

  pressKey(dir: Direction): void {
    this.keys = this.keys.filter((d) => d !== dir);
    this.keys.push(dir);
  }

  releaseKey(dir: Direction): void {
    this.keys = this.keys.filter((d) => d !== dir);
  }

  setStick(dir: Direction | null): void {
    this.stick = dir;
  }

  /** Drop all held input, e.g. on window blur, so nothing gets stuck. */
  clearHeld(): void {
    this.keys = [];
    this.stick = null;
    this.stickSlow = false;
    this.actionHeld = false;
  }

  on<K extends keyof InputEvents>(event: K, fn: Listener<K>): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener<never>>();
    this.listeners.set(event, set);
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  emit<K extends keyof InputEvents>(event: K, payload: InputEvents[K]): void {
    this.listeners.get(event)?.forEach((fn) => (fn as Listener<K>)(payload));
  }
}

export const inputHub = new InputHub();
