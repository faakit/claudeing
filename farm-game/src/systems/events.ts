import type { DaySummary } from '../state/GameState';

export type PanelType = 'shop' | 'bin' | 'sleep' | 'menu';

export interface GameEvents {
  toast: { text: string; kind?: 'info' | 'warn' | 'good' };
  inventoryChanged: undefined;
  moneyChanged: { delta: number };
  energyChanged: undefined;
  farmChanged: undefined;
  goalChanged: undefined;
  goalCompleted: { text: string; reward: number };
  openPanel: { type: PanelType };
  daySummary: DaySummary;
  levelUp: { skill: string; level: number };
  /** Ask the UI to run the sleep flow (bed confirmed, or the clock hit 02:00). */
  sleepRequest: { passedOut: boolean };
  saved: undefined;
  /** A setting that affects layout/behaviour changed (e.g. left-handed mode). */
  settingsChanged: undefined;
}

type Listener<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

/** Tiny typed pub/sub, Phaser-free. Systems emit; scenes subscribe and redraw. */
export class TypedEmitter {
  private listeners = new Map<keyof GameEvents, Set<Listener<never>>>();

  on<K extends keyof GameEvents>(event: K, fn: Listener<K>): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener<never>>();
    this.listeners.set(event, set);
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.listeners.get(event)?.forEach((fn) => (fn as Listener<K>)(payload));
  }
}

export const gameEvents = new TypedEmitter();

export const toast = (text: string, kind: 'info' | 'warn' | 'good' = 'info'): void =>
  gameEvents.emit('toast', { text, kind });
