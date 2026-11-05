import { Graphics } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import { getStake } from '../core/ropeStakes';
import { aimDirOf, type AimHint, type WindupInfo } from '../core/skillCaster';
import { arcAimShape } from '../heroes/arcKit';
import { chainAimShape } from '../heroes/chainKit';
import { hookAimShape } from '../heroes/hookKit';
import { nailAimShape } from '../heroes/nailKit';
import { ringAimShape } from '../heroes/ringKit';
import { mirrorAimShape } from '../heroes/mirrorKit';
import { WELL_BLAST, wellAimShape } from '../heroes/wellKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';

const ARROW_LEN = 2.15;
const HOOK_COLOR = 0x7ee8ff;
const RING_COLOR = 0xa78bfa;
const CHAIN_COLOR = 0x86efac;
const NAIL_COLOR = 0xf4bf6a;
const ARC_COLOR = 0x7dd3fc;
const WELL_COLOR = 0xf59e0b;
const MIRROR_COLOR = 0xa5d8ff;

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

function drawCircle(
  g: Graphics,
  ox: number,
  oy: number,
  radius: number,
  color: number,
  alpha: number,
): void {
  g.circle(ox, oy, radius);
  g.fill({ color, alpha });
  g.stroke({ color, width: 0.06, alpha: Math.min(0.85, alpha + 0.3) });
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
    aimHint?: AimHint | null,
  ) => void;
};

/** 技能瞄准时画扇形或落点圆；矛尖由 ballView 持续指示 targetDir。 */
export function createAimPreview(): AimPreview {
  const root = new Graphics();

  const sync = (
    player: BallBody,
    aimingSlot: number,
    sample: ActionSample,
    windup?: WindupInfo | null,
    _aimHint?: unknown,
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
    if (!slot) {
      return;
    }
    const ring = player.hero === 'ring';
    const chain = player.hero === 'chain';
    const nail = player.hero === 'nail';
    const arc = player.hero === 'arc';
    const well = player.hero === 'well';
    const mirror = player.hero === 'mirror';
    const color = ring
      ? RING_COLOR
      : chain
        ? CHAIN_COLOR
        : nail
          ? NAIL_COLOR
          : arc
            ? ARC_COLOR
            : well
              ? WELL_COLOR
              : mirror
                ? MIRROR_COLOR
                : HOOK_COLOR;
    const alpha = casting ? 0.16 : 0.28;
    if (ring) {
      const shape = ringAimShape(
        slot,
        player,
        sample.pointerX,
        sample.pointerY,
        sample.hasPointer,
        windup?.markX,
        windup?.markY,
      );
      if (shape?.kind === 'circle') {
        drawCircle(root, shape.offsetX, shape.offsetY, shape.radius, color, alpha);
      } else if (shape?.kind === 'cone') {
        drawCone(root, fx, fy, shape.halfRad, shape.radius, color, alpha);
      }
      drawAimArrow(root, fx, fy, color, slot === 2 ? 2.6 : ARROW_LEN);
      return;
    }
    if (chain) {
      const shape = chainAimShape(slot);
      if (shape?.kind === 'circle') {
        drawCircle(root, shape.offsetX, shape.offsetY, shape.radius, color, alpha);
      } else if (shape?.kind === 'cone') {
        drawCone(root, fx, fy, shape.halfRad, shape.radius, color, alpha);
      }
      drawAimArrow(root, fx, fy, color, slot === 4 ? 2.4 : ARROW_LEN);
      return;
    }
    if (nail) {
      const shape = nailAimShape(slot);
      if (shape) {
        drawCone(root, fx, fy, shape.halfRad, shape.radius, color, alpha);
      }
      drawAimArrow(root, fx, fy, color, slot === 3 ? 2.4 : ARROW_LEN);
      return;
    }
    if (arc) {
      const shape = arcAimShape(slot);
      if (shape?.kind === 'circle') {
        drawCircle(root, shape.offsetX, shape.offsetY, shape.radius, color, alpha);
      } else if (shape?.kind === 'cone') {
        drawCone(root, fx, fy, shape.halfRad, shape.radius, color, alpha);
      }
      drawAimArrow(root, fx, fy, color, slot === 1 ? 2.2 : ARROW_LEN);
      return;
    }
    if (well) {
      const stake = getStake(player.id);
      const shape = wellAimShape(
        slot,
        player,
        sample.pointerX,
        sample.pointerY,
        sample.hasPointer,
        windup?.markX,
        windup?.markY,
        stake,
      );
      if (shape?.kind === 'circle') {
        drawCircle(root, shape.offsetX, shape.offsetY, shape.radius, color, alpha);
      } else if (shape?.kind === 'band') {
        root.moveTo(shape.x0 - player.x, shape.y0 - player.y);
        root.lineTo(shape.x1 - player.x, shape.y1 - player.y);
        root.stroke({ color, width: shape.halfWidth * 2, cap: 'round', alpha: alpha + 0.12 });
      }
      if (slot === 1 && stake) {
        drawCircle(root, stake.x - player.x, stake.y - player.y, WELL_BLAST.radius, color, alpha);
      }
      drawAimArrow(root, fx, fy, color, slot === 1 ? 2.2 : ARROW_LEN);
      return;
    }
    if (mirror) {
      const shape = mirrorAimShape(slot, player, fx, fy);
      if (shape?.kind === 'circle') {
        drawCircle(root, shape.offsetX, shape.offsetY, shape.radius, color, alpha);
      } else if (shape?.kind === 'cone') {
        drawCone(root, fx, fy, shape.halfRad, shape.radius, color, alpha);
      } else if (shape?.kind === 'wall') {
        root.moveTo(shape.x0 - player.x, shape.y0 - player.y);
        root.lineTo(shape.x1 - player.x, shape.y1 - player.y);
        root.stroke({ color, width: shape.halfWidth * 2, cap: 'round', alpha: alpha + 0.18 });
      }
      drawAimArrow(root, fx, fy, color, slot === 2 ? 2.6 : ARROW_LEN);
      return;
    }
    const shape = hookAimShape(slot);
    const dir = aimDirOf(player, sample);
    if (shape) {
      drawCone(root, dir.x, dir.y, shape.halfRad, shape.radius, color, alpha);
    }
    drawAimArrow(root, dir.x, dir.y, color, slot === 3 ? 2.6 : ARROW_LEN);
  };

  return { root, sync };
}
