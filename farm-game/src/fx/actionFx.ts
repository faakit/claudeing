import { items } from '../data';
import { audio } from '../platform/audio';
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
  /** The player is shown in a tool-use pose, so the swinging tool icon would be a second tool. */
  posed = false,
): void {
  const { x, y } = FarmRenderer.center(res.tx, res.ty);
  const def = equipped ? items[equipped] : undefined;
  if (def?.type === 'tool') {
    if (!posed) fx.swing(player.x, player.y, def.icon, player.facing);
    audio.play('swing');
  }
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
    case 'forage': {
      const good = items[res.item ?? ''];
      if (good) {
        fx.sparkle(x, y - 4, parseInt(good.color.slice(1), 16));
        fx.itemPop(x, y - 8, good.icon);
        fx.floatText(player.x, above, `+${res.qty ?? 1} ${good.name}`, 0xf4ead2);
      }
      audio.play('harvest');
      break;
    }
    case 'cast':
      fx.splash(x, y);
      audio.play('water');
      break;
    case 'harvest': {
      const crop = items[res.item ?? ''];
      fx.sparkle(x, y - 4, parseInt((crop?.color ?? '#ffffff').slice(1), 16));
      if (crop) {
        fx.itemPop(x, y - 8, crop.icon);
        fx.floatText(player.x, above, `+${res.qty ?? 1} ${crop.name}`, 0xf4ead2);
      }
      if ((res.q ?? 0) > 0) {
        const gold = (res.q ?? 0) >= 2;
        fx.sparkle(x, y - 6, gold ? 0xf4d35e : 0xc9d3e4);
        fx.floatText(
          player.x,
          above - 10,
          gold ? 'Gold quality!' : 'Silver quality!',
          gold ? 0xf4d35e : 0xc9d3e4,
        );
      }
      audio.play('harvest');
      break;
    }
  }
}
