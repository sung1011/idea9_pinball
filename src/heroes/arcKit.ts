import type { SkillSlot } from '../input/actionTypes';

const EPS = 1e-8;

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < EPS) {
    return { x: 1, y: 0 };
  }
  return { x: x / len, y: y / len };
}

/** 闪弧四技能数值（设计锁）。瞄准无上限；前摇从释放后起算。 */
export const ARC_SIDESTEP = {
  slot: 1,
  cd: 7,
  windup: 0.15,
  fanDeg: 40,
  range: 6,
  behindPad: 0.12,
  /** 无合法目标：2s 短 CD，不进满 CD。 */
  failCd: 2,
} as const;

export const ARC_GRAZE = {
  slot: 2,
  cd: 9,
  windup: 0,
  duration: 8,
  extra: 6,
} as const;

export const ARC_MARK = {
  slot: 3,
  cd: 11,
  windup: 0.25,
  range: 5,
  duration: 6,
  extra: 14,
} as const;

export const ARC_PHASE = {
  slot: 4,
  cd: 14,
  windup: 0,
  duration: 2.4,
  minSpeed: 6,
  ramWindow: 0.2,
} as const;

/** 对内仍是闪弧四槽：侧移闪 / 擦伤刃 / 标记回响 / 虚晃 */
export const ARC_SKILL_INTERNAL = ['侧移闪', '擦伤刃', '标记回响', '虚晃'] as const;
/** 骑士闪弧对外显示名 */
export const ARC_SKILL_NAMES = ['侧闪', '掠刃', '回印', '虚影'] as const;
export const ARC_SKILL_SHORT = ['闪', '掠', '印', '虚'] as const;
export const ARC_KIT_DISPLAY_NAME = '骑士闪弧';

export const ARC_CDS = [ARC_SIDESTEP.cd, ARC_GRAZE.cd, ARC_MARK.cd, ARC_PHASE.cd] as const;

export type ArcAimShape =
  | { kind: 'circle'; radius: number; offsetX: number; offsetY: number }
  | { kind: 'cone'; halfRad: number; radius: number };

export function arcWindup(slot: SkillSlot): number {
  if (slot === 1) {
    return ARC_SIDESTEP.windup;
  }
  if (slot === 2) {
    return ARC_GRAZE.windup;
  }
  if (slot === 3) {
    return ARC_MARK.windup;
  }
  return ARC_PHASE.windup;
}

export function arcSkillCd(slot: SkillSlot): number {
  return ARC_CDS[slot - 1];
}

/** 侧移闪 / 虚晃是位移技；掠刃 / 标记回响不是。 */
export function arcIsDisplace(slot: SkillSlot): boolean {
  return slot === 1 || slot === 4;
}

/** 贴在敌人背后短距，朝向对敌（与敌朝向同向）。 */
export function behindEnemyPos(
  enemyX: number,
  enemyY: number,
  facingX: number,
  facingY: number,
  casterRadius: number,
  enemyRadius: number,
): { x: number; y: number; faceX: number; faceY: number } {
  const face = unit(facingX, facingY);
  const gap = casterRadius + enemyRadius + ARC_SIDESTEP.behindPad;
  return {
    x: enemyX - face.x * gap,
    y: enemyY - face.y * gap,
    faceX: face.x,
    faceY: face.y,
  };
}

/** 瞄准预览：侧闪用搜敌扇，回印用搜敌圆，掠刃/虚影只画箭头。 */
export function arcAimShape(slot: SkillSlot): ArcAimShape | null {
  if (slot === 1) {
    return {
      kind: 'cone',
      halfRad: (ARC_SIDESTEP.fanDeg * Math.PI) / 360,
      radius: ARC_SIDESTEP.range,
    };
  }
  if (slot === 3) {
    return { kind: 'circle', radius: ARC_MARK.range, offsetX: 0, offsetY: 0 };
  }
  return null;
}
