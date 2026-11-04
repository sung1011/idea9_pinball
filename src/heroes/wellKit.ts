import type { BallBody } from '../core/ballBody';
import { CRAWL_SPEED, FLOOR_SPEED, SPEED_CAP } from '../core/constants';
import type { SkillSlot } from '../input/actionTypes';

const EPS = 1e-8;

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < EPS) {
    return { x: 1, y: 0 };
  }
  return { x: x / len, y: y / len };
}

/** 井绳四技能数值（设计锁）。瞄准无上限；前摇从释放后起算。 */
export const WELL_HOOK = {
  slot: 1,
  cd: 10,
  windup: 0.4,
  lockRange: 6,
  landRange: 5,
  damage: 8,
  pullDist: 2,
  flySpeed: 16,
  landSpeed: 9,
} as const;

export const WELL_SWAP = {
  slot: 2,
  cd: 16,
  windup: 0.45,
  range: 5,
  damage: 5,
  speedKeep: 0.5,
} as const;

export const WELL_STAKE = {
  slot: 3,
  cd: 12,
  windup: 0.3,
  range: 6,
  duration: 5,
  radius: 0.32,
} as const;

export const WELL_REEL = {
  slot: 4,
  cd: 9,
  windup: 0,
  width: 1,
  damage: 6,
  pullDist: 2,
} as const;

/** 对内仍是井绳四槽：双钩 / 换位 / 弹索桩 / 收索 */
export const WELL_SKILL_INTERNAL = ['双钩', '换位', '弹索桩', '收索'] as const;
/** 骑士井绳对外显示名 */
export const WELL_SKILL_NAMES = ['双索', '易位', '索桩', '回索'] as const;
export const WELL_SKILL_SHORT = ['索', '易', '桩', '回'] as const;
export const WELL_KIT_DISPLAY_NAME = '骑士井绳';

export const WELL_CDS = [WELL_HOOK.cd, WELL_SWAP.cd, WELL_STAKE.cd, WELL_REEL.cd] as const;

/** 超速 / 上限 / 中速 / 保底 / 爬行；收索降一档沿此表下跳。 */
export const SPEED_TIER_STEPS = [12, SPEED_CAP, 5, FLOOR_SPEED, CRAWL_SPEED] as const;

export type WellAimShape =
  | { kind: 'circle'; radius: number; offsetX: number; offsetY: number }
  | { kind: 'band'; x0: number; y0: number; x1: number; y1: number; halfWidth: number };

export function wellWindup(slot: SkillSlot): number {
  if (slot === 1) {
    return WELL_HOOK.windup;
  }
  if (slot === 2) {
    return WELL_SWAP.windup;
  }
  if (slot === 3) {
    return WELL_STAKE.windup;
  }
  return WELL_REEL.windup;
}

export function wellSkillCd(slot: SkillSlot): number {
  return WELL_CDS[slot - 1];
}

/** 双钩 / 换位是位移技；弹索桩 / 收索不是。 */
export function wellIsDisplace(slot: SkillSlot): boolean {
  return slot === 1 || slot === 2;
}

export function wellPoint(
  ball: Pick<BallBody, 'x' | 'y' | 'facingX' | 'facingY'>,
  range: number,
  pointerX?: number,
  pointerY?: number,
  hasPointer?: boolean,
): { x: number; y: number } {
  if (hasPointer && pointerX !== undefined && pointerY !== undefined) {
    const dx = pointerX - ball.x;
    const dy = pointerY - ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist < EPS) {
      return { x: ball.x, y: ball.y };
    }
    const scale = Math.min(1, range / dist);
    return { x: ball.x + dx * scale, y: ball.y + dy * scale };
  }
  const face = unit(ball.facingX, ball.facingY);
  return { x: ball.x + face.x * range, y: ball.y + face.y * range };
}

export function nextSpeedTier(speed: number): number {
  for (const tier of SPEED_TIER_STEPS) {
    if (speed > tier + 1e-6) {
      return tier;
    }
  }
  return 0;
}

export function dropSpeedOneTier(ball: Pick<BallBody, 'vx' | 'vy'>): void {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < EPS) {
    return;
  }
  const next = nextSpeedTier(speed);
  if (next <= 0) {
    ball.vx = 0;
    ball.vy = 0;
    return;
  }
  const s = next / speed;
  ball.vx *= s;
  ball.vy *= s;
}

export function lightPullToward(
  ball: Pick<BallBody, 'x' | 'y'>,
  tx: number,
  ty: number,
  dist: number,
): void {
  const dx = tx - ball.x;
  const dy = ty - ball.y;
  const gap = Math.hypot(dx, dy);
  if (gap < EPS) {
    return;
  }
  const step = Math.min(dist, gap);
  ball.x += (dx / gap) * step;
  ball.y += (dy / gap) * step;
}

/** 瞄准预览：双索/易位/索桩用圆；回索画桩线。 */
export function wellAimShape(
  slot: SkillSlot,
  ball: Pick<BallBody, 'x' | 'y' | 'facingX' | 'facingY'>,
  pointerX?: number,
  pointerY?: number,
  hasPointer?: boolean,
  markX?: number,
  markY?: number,
  stake?: { x: number; y: number } | null,
  stage: 1 | 2 = 1,
): WellAimShape | null {
  if (slot === 1) {
    if (stage === 2) {
      const mark =
        markX !== undefined && markY !== undefined
          ? { x: markX, y: markY }
          : wellPoint(ball, WELL_HOOK.landRange, pointerX, pointerY, hasPointer);
      return {
        kind: 'circle',
        radius: 0.35,
        offsetX: mark.x - ball.x,
        offsetY: mark.y - ball.y,
      };
    }
    return { kind: 'circle', radius: WELL_HOOK.lockRange, offsetX: 0, offsetY: 0 };
  }
  if (slot === 2) {
    return { kind: 'circle', radius: WELL_SWAP.range, offsetX: 0, offsetY: 0 };
  }
  if (slot === 3) {
    const mark =
      markX !== undefined && markY !== undefined
        ? { x: markX, y: markY }
        : wellPoint(ball, WELL_STAKE.range, pointerX, pointerY, hasPointer);
    return {
      kind: 'circle',
      radius: WELL_STAKE.radius,
      offsetX: mark.x - ball.x,
      offsetY: mark.y - ball.y,
    };
  }
  if (stake) {
    return {
      kind: 'band',
      x0: ball.x,
      y0: ball.y,
      x1: stake.x,
      y1: stake.y,
      halfWidth: WELL_REEL.width / 2,
    };
  }
  return null;
}
