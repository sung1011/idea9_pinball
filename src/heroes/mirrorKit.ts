import type { BallBody } from '../core/ballBody';
import type { SkillSlot } from '../input/actionTypes';

const EPS = 1e-8;

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < EPS) {
    return { x: 1, y: 0 };
  }
  return { x: x / len, y: y / len };
}

/** 镜卫四技能数值（设计锁）。瞄准无上限；释放后即出效果。 */
export const MIRROR_REFRACT = {
  slot: 1,
  cd: 9,
  windup: 0,
  duration: 1.5,
  takenMul: 0.5,
} as const;

export const MIRROR_REFLECT = {
  slot: 2,
  cd: 8,
  windup: 0,
  fanDeg: 50,
  range: 5.5,
  cap: 60,
} as const;

export const MIRROR_SHATTER = {
  slot: 3,
  cd: 10,
  windup: 0,
  selfDamage: 24,
  splash: 12,
  radius: 2.2,
} as const;

export const MIRROR_WALL = {
  slot: 4,
  cd: 14,
  windup: 0,
  duration: 2.5,
  length: 2.2,
  halfWidth: 0.22,
  offset: 1.15,
} as const;

/** 对内仍是镜卫四槽：折光 / 反照 / 裂镜 / 镜壁 */
export const MIRROR_SKILL_INTERNAL = ['折光', '反照', '裂镜', '镜壁'] as const;
/** 骑士镜卫对外显示名 */
export const MIRROR_SKILL_NAMES = ['折光', '反照', '裂镜', '镜壁'] as const;
export const MIRROR_SKILL_SHORT = ['折', '反', '裂', '壁'] as const;
export const MIRROR_KIT_DISPLAY_NAME = '骑士镜卫';

export const MIRROR_CDS = [
  MIRROR_REFRACT.cd,
  MIRROR_REFLECT.cd,
  MIRROR_SHATTER.cd,
  MIRROR_WALL.cd,
] as const;

export type MirrorAimShape =
  | { kind: 'circle'; radius: number; offsetX: number; offsetY: number }
  | { kind: 'cone'; halfRad: number; radius: number }
  | { kind: 'wall'; x0: number; y0: number; x1: number; y1: number; halfWidth: number };

export function mirrorWindup(slot: SkillSlot): number {
  if (slot === 1) {
    return MIRROR_REFRACT.windup;
  }
  if (slot === 2) {
    return MIRROR_REFLECT.windup;
  }
  if (slot === 3) {
    return MIRROR_SHATTER.windup;
  }
  return MIRROR_WALL.windup;
}

export function mirrorSkillCd(slot: SkillSlot): number {
  return MIRROR_CDS[slot - 1];
}

/** 镜卫四技能都不是位移技。 */
export function mirrorIsDisplace(_slot: SkillSlot): boolean {
  return false;
}

export function mirrorWallSegment(
  ball: Pick<BallBody, 'x' | 'y' | 'facingX' | 'facingY'>,
  faceX?: number,
  faceY?: number,
): { x0: number; y0: number; x1: number; y1: number; halfWidth: number } {
  const face = unit(faceX ?? ball.facingX, faceY ?? ball.facingY);
  const cx = ball.x + face.x * MIRROR_WALL.offset;
  const cy = ball.y + face.y * MIRROR_WALL.offset;
  const px = -face.y;
  const py = face.x;
  const half = MIRROR_WALL.length / 2;
  return {
    x0: cx - px * half,
    y0: cy - py * half,
    x1: cx + px * half,
    y1: cy + py * half,
    halfWidth: MIRROR_WALL.halfWidth,
  };
}

/** 瞄准预览：折光/裂镜用身周圆，反照用扇，镜壁画身前短墙。 */
export function mirrorAimShape(
  slot: SkillSlot,
  ball: Pick<BallBody, 'x' | 'y' | 'facingX' | 'facingY'>,
  aimX?: number,
  aimY?: number,
): MirrorAimShape | null {
  if (slot === 1) {
    return { kind: 'circle', radius: 1.15, offsetX: 0, offsetY: 0 };
  }
  if (slot === 2) {
    return {
      kind: 'cone',
      halfRad: (MIRROR_REFLECT.fanDeg * Math.PI) / 360,
      radius: MIRROR_REFLECT.range,
    };
  }
  if (slot === 3) {
    return { kind: 'circle', radius: MIRROR_SHATTER.radius, offsetX: 0, offsetY: 0 };
  }
  const wall = mirrorWallSegment(ball, aimX, aimY);
  return { kind: 'wall', ...wall };
}
