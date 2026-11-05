import type { SkillSlot } from '../input/actionTypes';

/** 链生四技能数值（设计锁）。瞄准无上限；前摇从释放后起算。 */
export const CHAIN_HEAL = {
  slot: 1,
  cd: 10,
  windup: 0.3,
  fanDeg: 40,
  range: 6,
  dps: 6,
  duration: 4,
} as const;

export const CHAIN_SHIELD = {
  slot: 2,
  cd: 12,
  windup: 0,
  range: 5,
  duration: 3,
  dps: 8,
} as const;

export const CHAIN_TOW = {
  slot: 3,
  cd: 8,
  windup: 0,
  range: 8,
  flySpeed: 8,
  lowHpRatio: 0.4,
  pullDist: 2,
  knockback: 10,
} as const;

/** 愈链 / 盾脉 / 援勾无合法目标：2s 短 CD，不进满 CD。 */
export const CHAIN_FAIL_CD = 2;

/** 扰锋 / CHAOS：身周范围沉默（orientation scramble） */
export const CHAIN_SCRAMBLE = {
  slot: 4,
  cd: 15,
  windup: 0.2,
  range: 5,
  duration: 3,
} as const;

/** 对内仍是链生四槽：治疗链 / 护盾脉冲 / 勾友 / 范围沉默 */
export const CHAIN_SKILL_INTERNAL = ['治疗链', '护盾脉冲', '勾友', '范围沉默'] as const;
/** 骑士链生对外显示名 */
export const CHAIN_SKILL_NAMES = ['愈链', '盾脉', '援勾', '扰锋'] as const;
export const CHAIN_SKILL_SHORT = ['愈', '盾', '援', '扰'] as const;
export const CHAIN_KIT_DISPLAY_NAME = '骑士链生';

export const CHAIN_CDS = [CHAIN_HEAL.cd, CHAIN_SHIELD.cd, CHAIN_TOW.cd, CHAIN_SCRAMBLE.cd] as const;

export type ChainAimShape =
  | { kind: 'circle'; radius: number; offsetX: number; offsetY: number }
  | { kind: 'cone'; halfRad: number; radius: number };

export function chainWindup(slot: SkillSlot): number {
  if (slot === 1) {
    return CHAIN_HEAL.windup;
  }
  if (slot === 2) {
    return CHAIN_SHIELD.windup;
  }
  if (slot === 3) {
    return CHAIN_TOW.windup;
  }
  return CHAIN_SCRAMBLE.windup;
}

export function chainSkillCd(slot: SkillSlot): number {
  return CHAIN_CDS[slot - 1];
}

/** 勾友是位移技；治疗 / 盾脉贴附 / 沉默不是。 */
export function chainIsDisplace(slot: SkillSlot): boolean {
  return slot === 3;
}

/** 瞄准预览：愈链用扇，盾脉/援勾/扰锋用圆。 */
export function chainAimShape(slot: SkillSlot): ChainAimShape | null {
  if (slot === 1) {
    return { kind: 'cone', halfRad: (CHAIN_HEAL.fanDeg * Math.PI) / 360, radius: CHAIN_HEAL.range };
  }
  if (slot === 2) {
    return { kind: 'circle', radius: CHAIN_SHIELD.range, offsetX: 0, offsetY: 0 };
  }
  if (slot === 3) {
    return { kind: 'circle', radius: CHAIN_TOW.range, offsetX: 0, offsetY: 0 };
  }
  if (slot === 4) {
    return { kind: 'circle', radius: CHAIN_SCRAMBLE.range, offsetX: 0, offsetY: 0 };
  }
  return null;
}
