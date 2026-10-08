import type { ItemDef, ToolDef } from '../data';
import type { GameState, ItemStack } from '../state/GameState';

/** What the facing tile looks like, as computed by the scene from the map. */
export interface TileInfo {
  map: string;
  tx: number;
  ty: number;
  /** Ground kind from the tileset ("grass", "water", ...). */
  kind: string;
  tillable: boolean;
  /** An object or solid tile occupies it (bed, bin, wall...). */
  blocked: boolean;
  /** The current map holds the farm. Soil, crops and weeds only exist there. */
  farmland: boolean;
  /**
   * False when this farm tile is land the player has not bought. Undefined means "no land rules here"
   * (other maps, unit tests), which counts as allowed.
   */
  owned?: boolean;
  /** Describe another tile of the same map (for area tools). Absent in unit tests: tools then act on one tile. */
  at?: (tx: number, ty: number) => TileInfo | null;
}

/** Extra facts an action reports back (items gained, quality...). Free-form so mechanics can add fields. */
export type ActionDetail = { item?: string; qty?: number; q?: number } & Record<string, unknown>;

/**
 * A decided action. Building a plan changes nothing; `run` performs it. Keeping the two apart lets
 * the game ask "what would Action do on each nearby tile?" (smart one-thumb targeting) for free.
 */
export interface ActionPlan {
  /** What happened, for effects and sound (e.g. 'till', 'harvest'). Mechanics may add new kinds. */
  kind: string;
  tx: number;
  ty: number;
  run: () => ActionDetail;
}

/** A handler's answer: a plan, a refusal message, or null ("not mine, ask the next handler"). */
export type Planned = { plan: ActionPlan } | { refusal: string } | null;

export interface ActionContext {
  state: GameState;
  tile: TileInfo;
  /** The equipped stack, or null if the slot is empty. */
  stack: ItemStack | null;
  /** Its definition (null when nothing is equipped). */
  def: ItemDef | null;
}

/** Handlers run from highest priority down; the first non-null answer wins. */
export interface ActionHandler {
  id: string;
  priority: number;
  plan: (ctx: ActionContext) => Planned;
}

export interface ToolActionContext extends ActionContext {
  toolId: string;
  tool: ToolDef;
}

/** What a tool does, keyed by `action` in tools.json. Must return a plan or a refusal. */
export type ToolAction = (ctx: ToolActionContext) => { plan: ActionPlan } | { refusal: string };
