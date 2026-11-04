import { Graphics } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import { listTrapZones } from '../core/trapZones';
import { RING_FIELD } from '../heroes/ringKit';

export type FieldOverlay = {
  root: Graphics;
  sync: (balls: readonly BallBody[]) => void;
};

const AURA = 0x5eead4;
const TRAP = 0xa78bfa;

/** 磁场身周圈 + 困圈落点圈。 */
export function createFieldOverlay(): FieldOverlay {
  const root = new Graphics();

  const sync = (balls: readonly BallBody[]): void => {
    root.clear();
    for (const ball of balls) {
      if (!ball.inPlay || ball.fieldRemain <= 0) {
        continue;
      }
      const pulse = 0.14 + 0.08 * Math.min(1, ball.fieldRemain / RING_FIELD.duration);
      root.circle(ball.x, ball.y, RING_FIELD.radius);
      root.fill({ color: AURA, alpha: pulse });
      root.stroke({ color: AURA, width: 0.06, alpha: 0.55 });
    }
    for (const zone of listTrapZones()) {
      const pulse = 0.16 + 0.1 * Math.min(1, zone.remain);
      root.circle(zone.x, zone.y, zone.radius);
      root.fill({ color: TRAP, alpha: pulse });
      root.stroke({ color: TRAP, width: 0.07, alpha: 0.7 });
    }
  };

  return { root, sync };
}
