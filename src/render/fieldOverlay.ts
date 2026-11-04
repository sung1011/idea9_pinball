import { Graphics } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import { listBoomFlashes } from '../core/boomFlashes';
import { listStakes } from '../core/ropeStakes';
import { listTrapZones } from '../core/trapZones';
import { RING_FIELD } from '../heroes/ringKit';
import { WELL_STAKE } from '../heroes/wellKit';

export type FieldOverlay = {
  root: Graphics;
  sync: (balls: readonly BallBody[]) => void;
};

const AURA = 0x5eead4;
const TRAP = 0xa78bfa;
const MARK = 0xf0abfc;
const GRAZE = 0x7dd3fc;
const STAKE = 0xf59e0b;
const BOOM = 0xfb7185;

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
    for (const ball of balls) {
      if (!ball.inPlay) {
        continue;
      }
      if (ball.echoMarkRemain > 0) {
        root.circle(ball.x, ball.y, ball.radius + 0.28);
        root.stroke({ color: MARK, width: 0.06, alpha: 0.8 });
      }
      if (ball.grazeRemain > 0) {
        root.circle(ball.x, ball.y, ball.radius + 0.18);
        root.stroke({ color: GRAZE, width: 0.045, alpha: 0.7 });
      }
    }
    for (const zone of listTrapZones()) {
      const pulse = 0.16 + 0.1 * Math.min(1, zone.remain);
      root.circle(zone.x, zone.y, zone.radius);
      root.fill({ color: TRAP, alpha: pulse });
      root.stroke({ color: TRAP, width: 0.07, alpha: 0.7 });
    }
    for (const stake of listStakes()) {
      const pulse = 0.28 + 0.12 * Math.min(1, stake.remain / WELL_STAKE.duration);
      root.circle(stake.x, stake.y, stake.radius);
      root.fill({ color: STAKE, alpha: pulse });
      root.stroke({ color: STAKE, width: 0.07, alpha: 0.85 });
    }
    for (const flash of listBoomFlashes()) {
      const life = Math.max(flash.life, 1e-6);
      const pulse = 0.1 + 0.28 * Math.min(1, flash.remain / life);
      root.circle(flash.x, flash.y, flash.radius);
      root.fill({ color: BOOM, alpha: pulse });
      root.stroke({ color: BOOM, width: 0.07, alpha: 0.7 });
    }
  };

  return { root, sync };
}
