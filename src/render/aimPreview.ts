import { Graphics } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import type { ActionSample } from '../input/actionTypes';

const CONE_HALF = (48 * Math.PI) / 360;
const CONE_RADIUS = 2.35;
const ARROW_LEN = 2.15;

function drawCone(g: Graphics, fx: number, fy: number, color: number, alpha: number): void {
  const ang = Math.atan2(fy, fx);
  g.moveTo(0, 0);
  g.arc(0, 0, CONE_RADIUS, ang - CONE_HALF, ang + CONE_HALF);
  g.closePath();
  g.fill({ color, alpha });
}

function drawAimArrow(g: Graphics, fx: number, fy: number, color: number): void {
  const tipX = fx * ARROW_LEN;
  const tipY = fy * ARROW_LEN;
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
  sync: (player: BallBody, aimingSlot: number, sample: ActionSample) => void;
};

/** 瞄准扇形 + 箭头；微调窗内用较弱箭头标出 Aim。 */
export function createAimPreview(): AimPreview {
  const root = new Graphics();

  const sync = (player: BallBody, aimingSlot: number, sample: ActionSample): void => {
    root.clear();
    root.position.set(player.x, player.y);
    if (!player.inPlay || !sample.hasAim) {
      return;
    }
    const aiming = aimingSlot !== 0;
    const fine = player.fineTuneRemain > 0;
    if (!aiming && !fine) {
      return;
    }
    const color = aiming ? 0x7ee8ff : 0xffe08a;
    if (aiming) {
      drawCone(root, sample.aimX, sample.aimY, color, 0.28);
    }
    drawAimArrow(root, sample.aimX, sample.aimY, color);
  };

  return { root, sync };
}
