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
   * A world touch held still for the paint delay: the world calls `accept()` if painting a row can start
   * there (a tile Action can work); the touch then paints instead of being a tap or the stick.
   */
  paintArm: TapPoint & { accept: () => void };
  /** The painting finger moved (logical screen coordinates). */
  paintMove: TapPoint;
  /** The painting finger lifted; `onDock` when it lifted outside the world view (cancel). */
  paintEnd: TapPoint & { onDock: boolean };
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
  /** True while the Action button or Space is held, so tools repeat. */
  actionHeld = false;
  /**
   * The hotbar slot Action would use right now (auto tool may pick another than the selected one), set
   * by the world each frame so the Action button can show it. Null when Action has nothing to do.
   */
  actionSlot: number | null = null;
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
