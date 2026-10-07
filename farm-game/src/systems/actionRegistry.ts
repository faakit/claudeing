import type { ActionHandler, ToolAction } from './actionTypes';

/**
 * Storage for the action extension points. Deliberately dependency-free so mechanics can register
 * into it without import cycles. Use the helpers in `actions.ts` to plan and perform.
 */
const handlers: ActionHandler[] = [];
const toolActions = new Map<string, ToolAction>();

/** Register (or replace, by id) an item/tile action handler. */
export function registerActionHandler(handler: ActionHandler): void {
  const i = handlers.findIndex((h) => h.id === handler.id);
  if (i >= 0) handlers[i] = handler;
  else handlers.push(handler);
}

export function unregisterActionHandler(id: string): void {
  const i = handlers.findIndex((h) => h.id === id);
  if (i >= 0) handlers.splice(i, 1);
}

/** Handlers from highest priority to lowest (stable for ties: first registered first). */
export function orderedHandlers(): ActionHandler[] {
  return handlers
    .map((h, i) => ({ h, i }))
    .sort((a, b) => b.h.priority - a.h.priority || a.i - b.i)
    .map(({ h }) => h);
}

/** Register what a tool's `action` (from tools.json) does. */
export function registerToolAction(action: string, impl: ToolAction): void {
  toolActions.set(action, impl);
}

export const toolActionFor = (action: string): ToolAction | undefined => toolActions.get(action);
