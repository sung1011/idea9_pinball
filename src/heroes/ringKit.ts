import type { BallBody } from '../core/ballBody';
import type { SkillSlot } from '../input/actionTypes';

/** 磁环四技能数值（设计锁）。瞄准无上限；前摇从释放后起算。 */
export const RING_FIELD = {
  slot: 1,
  cd: 11,
  windup: 0,
  radius: 2,
  duration: 5,
  dps: 6,
} as const;

export const RING_WAVE = {
  slot: 2,
  cd: 9,
  windup: 0,
  fanDeg: 70,
  range: 4,
  knockback: 9,
  damage: 8,
} as const;

export const RING_SLIDE = {
  slot: 3,
  cd: 14,
  windup: 0,
  slideTime: 4,
  popSpeed: 8,
} as const;

export const RING_TRAP = {
  slot: 4,
  cd: 12,
  windup: 0.35,
  placeRange: 4,
  radius: 2.5,
  duration: 3.8,
  punishCd: 2,
} as const;

/**
 * 磁环第五键沉磁井（暂名）。吸力只改速度、不搬位置。
 * pullAccel / pullSoftRadius 为首测校准值，见 verifyRingUlt 可重复证据。
 */
export const RING_ULT = {
  slot: 5,
  energyCost: 100,
  placeRange: 6,
  radius: 4,
  duration: 3,
  damageBase: 20,
  damagePerN: 10,
  /** 圈内向心加速度（格/秒²）；不改全局摩擦/上限 */
  pullAccel: 7,
  /** 距圆心小于此值时加速度按距离线性减弱，防中心抖动 */
  pullSoftRadius: 0.9,
  /** 等距判定（格），避免浮点来回切换 */
  equalDistEps: 1e-4,
} as const;

/** 对内仍是磁环四槽：磁场 / 推波 / 粘壁 / 困圈 */
export const RING_SKILL_INTERNAL = ['磁场', '推波', '粘壁', '困圈'] as const;
/** 骑士磁环对外显示名 */
export const RING_SKILL_NAMES = ['辉环', '斥波', '壁行', '囚环'] as const;
export const RING_SKILL_SHORT = ['辉', '斥', '壁', '囚'] as const;
export const RING_KIT_DISPLAY_NAME = '骑士磁环';

export const RING_CDS = [RING_FIELD.cd, RING_WAVE.cd, RING_SLIDE.cd, RING_TRAP.cd] as const;

export type RingAimShape =
  | { kind: 'circle'; radius: number; offsetX: number; offsetY: number }
  | { kind: 'cone'; halfRad: number; radius: number };

export function ringWindup(slot: SkillSlot): number {
  if (slot === 1) {
    return RING_FIELD.windup;
  }
  if (slot === 2) {
    return RING_WAVE.windup;
  }
  if (slot === 3) {
    return RING_SLIDE.windup;
  }
  if (slot === 5) {
    return 0;
  }
  return RING_TRAP.windup;
}

export function ringSkillCd(slot: SkillSlot): number {
  return RING_CDS[slot - 1];
}

/** 粘壁是位移技；磁场 / 推波 / 困圈 / 沉磁井不是。 */
export function ringIsDisplace(slot: SkillSlot): boolean {
  return slot === 3;
}

export function ringTrapCenter(
  ball: Pick<BallBody, 'x' | 'y'>,
  pointerX?: number,
  pointerY?: number,
  hasPointer?: boolean,
): { x: number; y: number } {
  if (!hasPointer || pointerX === undefined || pointerY === undefined) {
    return { x: ball.x, y: ball.y };
  }
  const dx = pointerX - ball.x;
  const dy = pointerY - ball.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    return { x: ball.x, y: ball.y };
  }
  const scale = Math.min(1, RING_TRAP.placeRange / dist);
  return { x: ball.x + dx * scale, y: ball.y + dy * scale };
}

export function ringUltCenter(
  ball: Pick<BallBody, 'x' | 'y'>,
  pointerX?: number,
  pointerY?: number,
  hasPointer?: boolean,
): { x: number; y: number } {
  if (!hasPointer || pointerX === undefined || pointerY === undefined) {
    return { x: ball.x, y: ball.y };
  }
  const dx = pointerX - ball.x;
  const dy = pointerY - ball.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    return { x: ball.x, y: ball.y };
  }
  const scale = Math.min(1, RING_ULT.placeRange / dist);
  return { x: ball.x + dx * scale, y: ball.y + dy * scale };
}

/** 瞄准预览：磁场/困圈/沉磁井用圆，推波用扇，粘壁只画箭头。 */
export function ringAimShape(
  slot: SkillSlot,
  ball: Pick<BallBody, 'x' | 'y'>,
  pointerX?: number,
  pointerY?: number,
  hasPointer?: boolean,
  markX?: number,
  markY?: number,
): RingAimShape | null {
  if (slot === 1) {
    return { kind: 'circle', radius: RING_FIELD.radius, offsetX: 0, offsetY: 0 };
  }
  if (slot === 2) {
    return { kind: 'cone', halfRad: (RING_WAVE.fanDeg * Math.PI) / 360, radius: RING_WAVE.range };
  }
  if (slot === 4) {
    const mark =
      markX !== undefined && markY !== undefined
        ? { x: markX, y: markY }
        : ringTrapCenter(ball, pointerX, pointerY, hasPointer);
    return {
      kind: 'circle',
      radius: RING_TRAP.radius,
      offsetX: mark.x - ball.x,
      offsetY: mark.y - ball.y,
    };
  }
  if (slot === 5) {
    const mark =
      markX !== undefined && markY !== undefined
        ? { x: markX, y: markY }
        : ringUltCenter(ball, pointerX, pointerY, hasPointer);
    return {
      kind: 'circle',
      radius: RING_ULT.radius,
      offsetX: mark.x - ball.x,
      offsetY: mark.y - ball.y,
    };
  }
  return null;
}
