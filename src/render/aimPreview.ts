import { Graphics } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import type { WindupInfo } from '../core/skillCaster';
import { hookAimShape } from '../heroes/hookKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';

const ARROW_LEN = 2.15;

function drawCone(
  g: Graphics,
  fx: number,
  fy: number,
  half: number,
  radius: number,
  color: number,
  alpha: number,
): void {
  const ang = Math.atan2(fy, fx);
  g.moveTo(0, 0);
  g.arc(0, 0, radius, ang - half, ang + half);
  g.closePath();
  g.fill({ color, alpha });
}

function drawAimArrow(g: Graphics, fx: number, fy: number, color: number, len = ARROW_LEN): void {
  const tipX = fx * len;
  const tipY = fy * len;
  g.moveTo(fx * 0.55, fy * 0.55);
  g.lineTo(tipX, tipY);
  g.stroke({ color, width: 0.08, cap: 'round', alpha: 0.95 });

  const px = -fy;
  const py = fx;
  g.moveTo(tipX, tipY);
  g.lineTo(tipX - fx * 0.28 + px * 0.12, tipY - fy * 0.28 + py * 0.12);
  g.lineTo(tipX - fx * 0.28 - px * 0.12, tipY - fy * 0.28 - py * 0.12);
  g.closePath();
  g.fill({ color, alpha: 0.95 });
}

export type AimPreview = {
  root: Graphics;
  sync: (
    player: BallBody,
    aimingSlot: number,
    sample: ActionSample,
    windup?: WindupInfo | null,
  ) => void;
};

/** 技能瞄准时画扇形；矛尖由 ballView 持续指示 targetDir。 */
export function createAimPreview(): AimPreview {
  const root = new Graphics();

  const sync = (
    player: BallBody,
    aimingSlot: number,
    sample: ActionSample,
    windup?: WindupInfo | null,
  ): void => {
    root.clear();
    root.position.set(player.x, player.y);
    if (!player.inPlay) {
      return;
    }
    const aiming = aimingSlot !== 0;
    const casting = !!windup;
    if (!aiming && !casting) {
      return;
    }
    const fx = sample.hasAim ? sample.aimX : player.facingX;
    const fy = sample.hasAim ? sample.aimY : player.facingY;
    const slot = (aiming ? aimingSlot : windup?.slot ?? 0) as SkillSlot | 0;
    if (slot) {
      const shape = hookAimShape(slot);
      if (shape) {
        drawCone(root, fx, fy, shape.halfRad, shape.radius, 0x7ee8ff, casting ? 0.16 : 0.28);
      }
      drawAimArrow(root, fx, fy, 0x7ee8ff, slot === 3 ? 2.6 : ARROW_LEN);
    }
  };

  return { root, sync };
}
