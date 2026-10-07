import { game, items } from '../data';

/**
 * Identity of a kind of stack. Two stacks merge only when all three fields match:
 *  - `item`: the id from items.json
 *  - `q`:    quality tier (0 normal, 1 silver, 2 gold); omitted when 0
 *  - `of`:   for derived goods (jam, pickles...), the item it was made from
 */
export interface ItemRef {
  item: string;
  q?: number;
  of?: string;
}

export interface StackLike extends ItemRef {
  qty: number;
}

/** Normalised ref: quality 0 and empty `of` are omitted so equal refs are structurally equal. */
export function refOf(s: ItemRef): ItemRef {
  const ref: ItemRef = { item: s.item };
  if (s.q) ref.q = s.q;
  if (s.of) ref.of = s.of;
  return ref;
}

export const keyOf = (r: ItemRef): string => `${r.item}|${r.q ?? 0}|${r.of ?? ''}`;

export function parseKey(key: string): ItemRef {
  const [item = '', q = '0', of = ''] = key.split('|');
  return refOf({ item, q: Number(q) || 0, of: of || undefined });
}

export const sameRef = (a: ItemRef, b: ItemRef): boolean => keyOf(a) === keyOf(b);

export const QUALITY_LABELS = ['', 'Silver', 'Gold'] as const;

/** Player-facing name: "Parsnip", "Gold Parsnip", "Tomato Jam". */
export function displayName(ref: ItemRef): string {
  const def = items[ref.item];
  if (!def) return ref.item;
  let name = def.name;
  if (def.derived && ref.of) {
    const base = items[ref.of]?.name ?? ref.of;
    name = (def.nameTemplate ?? '{of}').replace('{of}', base);
  }
  const q = QUALITY_LABELS[ref.q ?? 0] ?? '';
  return q ? `${q} ${name}` : name;
}

export const iconKey = (ref: ItemRef): string => items[ref.item]?.icon ?? 'ui_coin';

/** Gold value of one unit, including quality and (for derived goods) the value of what it was made from. */
export function sellValue(ref: ItemRef): number {
  const def = items[ref.item];
  if (!def || def.type === 'tool') return 0;
  let base = def.sellPrice ?? 0;
  if (def.derived && ref.of)
    base += Math.round((items[ref.of]?.sellPrice ?? 0) * (def.sellMultiplier ?? 1));
  const mult = game.qualityMultipliers[ref.q ?? 0] ?? 1;
  return Math.round(base * mult);
}
