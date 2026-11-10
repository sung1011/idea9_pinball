import { HOOK_SKILL_NAMES } from '../heroes/hookKit';
import type { HookTechId } from './techIds';

/** 钩刺科技只加条件强化，不改基础技能既定值。 */
export const HOOK_PULL_TECH = {
  id: 'hookPull' as const,
  cost: 30,
  farPathRatio: 0.7,
  cdRefundRatio: 0.2,
} as const;

export const HOOK_STAB_TECH = {
  id: 'hookStab' as const,
  cost: 30,
  ticks: 3,
  interval: 1,
  damage: 4,
} as const;

export const HOOK_SHOVE_TECH = {
  id: 'hookShove' as const,
  cost: 50,
  shieldHp: 12,
  shieldSec: 2,
} as const;

export const HOOK_BRAKE_TECH = {
  id: 'hookBrake' as const,
  cost: 50,
  chargeRatio: 0.8,
  extraDamage: 8,
} as const;

export type HookTechDef = {
  id: HookTechId;
  slot: 1 | 2 | 3 | 4;
  cost: number;
  name: string;
  effect: string;
};

export const HOOK_TECH_DEFS: readonly HookTechDef[] = [
  {
    id: HOOK_PULL_TECH.id,
    slot: 1,
    cost: HOOK_PULL_TECH.cost,
    name: HOOK_SKILL_NAMES[0],
    effect:
      '钩矛飞行路径达到本次最大射程 70% 才算远距（不是命中瞬间双方距离）。实际命中非无敌敌方时，按本次完整 CD 扣 20% 剩余冷却，每次释放最多 1 次，最低到 0。普通盾可触发，无敌/空/墙/友不触发。',
  },
  {
    id: HOOK_STAB_TECH.id,
    slot: 2,
    cost: HOOK_STAB_TECH.cost,
    name: HOOK_SKILL_NAMES[1],
    effect:
      '同一次三下都有效命中敌人即可（可不同敌），仅第三下给该目标流血：触发后第 1/2/3 秒各 4 伤，共 12。同施法者同目标不叠层，再触发重计 3 秒。普通盾算有效，无敌不算。',
  },
  {
    id: HOOK_SHOVE_TECH.id,
    slot: 3,
    cost: HOOK_SHOVE_TECH.cost,
    name: HOOK_SKILL_NAMES[2],
    effect:
      '盾冲实际撞中非无敌敌方后获得 12 点护盾 2 秒，每次盾冲最多一次。碰撞伤害先结算再发盾，不能挡本次对撞；自己已死不挂幽灵盾。再触发重置 12 点与 2 秒，不叠加。',
  },
  {
    id: HOOK_BRAKE_TECH.id,
    slot: 4,
    cost: HOOK_BRAKE_TECH.cost,
    name: HOOK_SKILL_NAMES[3],
    effect:
      '蓄力到本次最大有效蓄力 80% 以上弹出，本次弹出首次碰撞必须直接命中非无敌敌方才追加 8 点伤。先撞墙/障碍/友军或无敌敌人则失去该次资格，不能绕行补触发。',
  },
];

export function hookTechDef(id: HookTechId): HookTechDef {
  return HOOK_TECH_DEFS.find((item) => item.id === id) ?? HOOK_TECH_DEFS[0];
}
