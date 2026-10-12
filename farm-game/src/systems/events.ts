import type { DaySummary } from '../state/GameState';

export type PanelType =
  | 'shop'
  | 'bin'
  | 'sleep'
  | 'menu'
  | 'board'
  | 'craft'
  | 'skills'
  | 'book'
  | 'festival'
  | 'projects'
  | 'mail'
  | 'fishing'
  | 'cart';

export interface GameEvents {
  toast: { text: string; kind?: 'info' | 'warn' | 'good' };
  inventoryChanged: undefined;
  moneyChanged: { delta: number };
  energyChanged: undefined;
  farmChanged: undefined;
  goalChanged: undefined;
  goalCompleted: { text: string; reward: number };
  openPanel: { type: PanelType };
  /** Open one project's page (a place's fund or a site upgrade, from its site). */
  openProject: { id: string };
  daySummary: DaySummary;
  levelUp: { skill: string; level: number };
  /** Objects were placed/removed/changed on a map: renderers should resync. */
  placedChanged: { map: string };
  /** Ore nodes on a map changed (spawned or broken): renderers and collision resync. */
  nodesChanged: { map: string };
  /** Forageables on a map changed (spawned or picked). */
  forageChanged: { map: string };
  /** Ask the UI to open a placed object's panel (jar picker...). */
  placedPanel: { panel: string; id: number };
  /** A fish was landed (the farmer's reel animation plays when the sheet closes). */
  fishCaught: undefined;
  /** Start the fishing mini-game; resolve with the outcome. */
  startFishing: { map: string; fish: string; bait: boolean };
  /** Ask the UI to run the sleep flow (bed confirmed, or the clock hit 02:00). */
  sleepRequest: { passedOut: boolean };
  /** A villager's friendship reached a new heart (for a flourish). */
  heartUp: { id: string; hearts: number };
  /** Friendship changed (a chat, a gift): villager markers and panels refresh. */
  friendsChanged: undefined;
  /** The player wants to talk to a villager. */
  talkTo: { id: string };
  /** The player used a land sign: ask whether to buy that plot. */
  buyPlot: { id: string };
  saved: undefined;
  /** A letter arrived, was read, or its gift was taken: the mailbox marker refreshes. */
  mailChanged: undefined;
  /** A setting that affects layout/behaviour changed (e.g. left-handed mode). */
  settingsChanged: undefined;
  /** A moment the valley marks with the HUD banner and a jingle (the first green). */
  /** `farmerY`: the farmer's feet in screen px, so the banner can keep off them. */
  /** `delay`: ms before it shows; `cue`: the jingle to play instead of `green` (a homecoming's, audio lane). */
  valleyMoment: { text: string; farmerY?: number; delay?: number; cue?: string };
  /** A rebuilt house's window lit for the first time, its family home (audio's `window-lit` sting). Once a house. */
  houseLit: { house: string };
  /** A game was entered from the title (New Game, Continue or a scenario): the state is set, the world opening. */
  gameEntered: undefined;
  /** A guided-start step was finished or passed (systems/tutorial.ts); `skipped` when the player skipped it. */
  tutorialStep: { id: string; track: string; skipped: boolean };
  /** The player skipped the whole guided start (the coach line's menu). */
  tutorialSkipped: undefined;
  /** The player picked a language (Menu > Opts or the title), not the boot-time choice. */
  languageChosen: { lang: string };
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
