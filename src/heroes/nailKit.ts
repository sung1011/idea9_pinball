import type { SkillSlot } from '../input/actionTypes';

/** 钉壳四技能数值（设计锁）。瞄准无上限；前摇从释放后起算。 */
export const NAIL_ARMOR = {
  slot: 1,
  cd: 10,
  windup: 0,
  duration: 1.5,
  mul: 0.4,
  heal: 8,
} as const;

export const NAIL_THORN = {
  slot: 2,
  cd: 9,
  windup: 0,
  passiveWindow: 0.5,
  passiveDamage: 12,
  passivePush: 4,
  activeWindow: 1,
  activeDamage: 16,
} as const;

export const NAIL_RAM = {
  slot: 3,
  cd: 8,
  windup: 0,
  dashDist: 3,
  dashTime: 0.25,
  damage: 10,
} as const;

export const NAIL_PIN = {
  slot: 4,
  cd: 13,
  windup: 0.3,
  fanDeg: 45,
  range: 5,
  duration: 0.6,
  damage: 6,
  breakDist: 1,
  allyRamExtra: 10,
} as const;

/** 对内仍是钉壳四槽：叠甲 / 反击刺 / 短冲顶 / 定锚 */
export const NAIL_SKILL_INTERNAL = ['叠甲', '反击刺', '短冲顶', '定锚'] as const;
/** 骑士钉壳对外显示名 */
export const NAIL_SKILL_NAMES = ['甲垒', '刺盾', '顶冲', '钉锚'] as const;
export const NAIL_SKILL_SHORT = ['甲', '刺', '顶', '钉'] as const;
export const NAIL_KIT_DISPLAY_NAME = '骑士钉壳';

export const NAIL_CDS = [NAIL_ARMOR.cd, NAIL_THORN.cd, NAIL_RAM.cd, NAIL_PIN.cd] as const;

export type NailAimShape = {
  halfRad: number;
  radius: number;
};

export function nailWindup(slot: SkillSlot): number {
  if (slot === 1) {
    return NAIL_ARMOR.windup;
  }
  if (slot === 2) {
    return NAIL_THORN.windup;
  }
  if (slot === 3) {
    return NAIL_RAM.windup;
  }
  return NAIL_PIN.windup;
}

export function nailSkillCd(slot: SkillSlot): number {
  return NAIL_CDS[slot - 1];
}

/** 短冲顶是位移技；叠甲 / 反击刺 / 定锚不是。 */
export function nailIsDisplace(slot: SkillSlot): boolean {
  return slot === 3;
}

/** 瞄准预览：顶冲用冲刺线段，钉锚用扇，甲/刺只画箭头。 */
export function nailAimShape(slot: SkillSlot): NailAimShape | null {
  if (slot === 3) {
    return { halfRad: (8 * Math.PI) / 360, radius: NAIL_RAM.dashDist };
  }
  if (slot === 4) {
    return { halfRad: (NAIL_PIN.fanDeg * Math.PI) / 360, radius: NAIL_PIN.range };
  }
  return null;
}
