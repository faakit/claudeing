import { items } from '../data';
import { audio } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { PlayerState } from '../state/GameState';
import type { ActionResult } from '../systems/actions';
import { FarmRenderer } from '../game/FarmRenderer';
import type { Effects } from './Effects';

type Success = Extract<ActionResult, { ok: true }>;

/** Particles, floating text and sound for a successful action. Purely presentational. */
export function playActionFx(
  fx: Effects,
  res: Success,
  player: PlayerState,
  equipped?: string,
): void {
  const { x, y } = FarmRenderer.center(res.tx, res.ty);
  const def = equipped ? items[equipped] : undefined;
  if (def?.type === 'tool') {
    fx.swing(player.x, player.y, def.icon, player.facing);
    audio.play('swing');
  }
  haptic(res.kind === 'harvest' ? 'success' : 'tick');
  const above = player.y - 30;
  switch (res.kind) {
    case 'till':
      fx.dust(x, y);
      audio.play('till');
      break;
    case 'water':
      fx.splash(x, y);
      audio.play('water');
      break;
    case 'refill':
      fx.splash(x, y);
      fx.floatText(player.x, above, 'Refilled!', 0x6fa3e0);
      audio.play('refill');
      break;
    case 'clear':
      fx.leaves(x, y);
      fx.floatText(player.x, above, '+1 Fiber', 0x7fc96b);
      audio.play('cut');
      break;
    case 'plant':
      fx.dust(x, y);
      audio.play('plant');
      break;
    case 'harvest': {
      const crop = items[res.item ?? ''];
      fx.sparkle(x, y - 4, parseInt((crop?.color ?? '#ffffff').slice(1), 16));
      if (crop) {
        fx.itemPop(x, y - 8, crop.icon);
        fx.floatText(player.x, above, `+${res.qty ?? 1} ${crop.name}`, 0xf4ead2);
      }
      audio.play('harvest');
      break;
    }
  }
}
