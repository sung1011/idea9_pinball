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
  duration: 3.2,
  mul: 0.45,
} as const;

export const CHAIN_TOW = {
  slot: 3,
  cd: 8,
  windup: 0,
  range: 8,
  flySpeed: 8,
  lowHpRatio: 0.4,
  pullDist: 2,
} as const;

export const CHAIN_SCRAMBLE = {
  slot: 4,
  cd: 7,
  windup: 0.2,
  fanDeg: 50,
  range: 4,
  damage: 4,
  turnRad: Math.PI / 2,
} as const;

/** 对内仍是链生四槽：治疗链 / 护盾脉冲 / 勾友 / 朝向打乱 */
export const CHAIN_SKILL_INTERNAL = ['治疗链', '护盾脉冲', '勾友', '朝向打乱'] as const;
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

/** 勾友是位移技；治疗 / 护盾 / 打乱不是。 */
export function chainIsDisplace(slot: SkillSlot): boolean {
  return slot === 3;
}

/** 瞄准预览：愈链/扰锋用扇，盾脉/援勾用搜友圆。 */
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
    return {
      kind: 'cone',
      halfRad: (CHAIN_SCRAMBLE.fanDeg * Math.PI) / 360,
      radius: CHAIN_SCRAMBLE.range,
    };
  }
  return null;
}
