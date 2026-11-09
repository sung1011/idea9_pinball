import type { SkillSlot } from '../input/actionTypes';

/** 钩刺四技能数值（设计锁）。瞄准无上限；前摇从释放后起算。 */
export const HOOK_PULL = {
  slot: 1,
  cd: 8,
  missCd: 4,
  windup: 0.4,
  fanDeg: 50,
  range: 6,
  flySpeed: 10,
  damage: 8,
} as const;

export const HOOK_STAB = {
  slot: 2,
  cd: 6,
  windup: 0.25,
  fanDeg: 40,
  range: 2.2,
  interval: 0.15,
  hits: 3,
  damages: [9, 9, 14] as const,
  selfPush: 0.4,
  thirdStun: 0.25,
} as const;

export const HOOK_SHOVE = {
  slot: 3,
  cd: 10,
  windup: 0.35,
  dashDist: 4.5,
  dashTime: 0.35,
  hitPush: 12,
  damage: 12,
  keepSpeed: 0.7,
} as const;

export const HOOK_BRAKE = {
  slot: 4,
  cd: 12,
  windup: 0,
  brakeTime: 2.6,
  frictionMul: 10,
  popSpeed: 16.5,
} as const;

/** 对内仍是钩刺四槽：勾过来 / 方向捅 / 推过去 / 急停蓄弹 */
export const HOOK_SKILL_INTERNAL = ['勾过来', '方向捅', '推过去', '急停蓄弹'] as const;
/** 骑士冲杀对外显示名 */
export const HOOK_SKILL_NAMES = ['钩矛', '连刺', '盾冲', '蓄势'] as const;
export const HOOK_SKILL_SHORT = ['钩', '刺', '冲', '蓄'] as const;
export const KIT_DISPLAY_NAME = '骑士冲杀';

export const HOOK_CDS = [HOOK_PULL.cd, HOOK_STAB.cd, HOOK_SHOVE.cd, HOOK_BRAKE.cd] as const;

export type HookAimShape = {
  halfRad: number;
  radius: number;
};

export function hookWindup(slot: SkillSlot): number {
  if (slot === 1) {
    return HOOK_PULL.windup;
  }
  if (slot === 2) {
    return HOOK_STAB.windup;
  }
  if (slot === 3) {
    return HOOK_SHOVE.windup;
  }
  return HOOK_BRAKE.windup;
}

export function hookSkillCd(slot: SkillSlot): number {
  return HOOK_CDS[slot - 1];
}

/** 勾飞 / 盾冲 / 蓄势弹出算位移技，吃困圈禁止。 */
export function hookIsDisplace(slot: SkillSlot): boolean {
  return slot === 1 || slot === 3 || slot === 4;
}

/** 瞄准预览：勾/捅用扇形，推过去用冲刺线段，急停只画箭头。 */
export function hookAimShape(slot: SkillSlot): HookAimShape | null {
  if (slot === 1) {
    return { halfRad: (HOOK_PULL.fanDeg * Math.PI) / 360, radius: HOOK_PULL.range };
  }
  if (slot === 2) {
    return { halfRad: (HOOK_STAB.fanDeg * Math.PI) / 360, radius: HOOK_STAB.range };
  }
  if (slot === 3) {
    return { halfRad: (8 * Math.PI) / 360, radius: HOOK_SHOVE.dashDist };
  }
  return null;
}
