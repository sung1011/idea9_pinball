import type { BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import { applyHpLoss, type HpLossOpts } from './hpLoss';

export type SkillDamageOpts = HpLossOpts & {
  /** 裂镜自伤：允许打自己，仍走无敌 / 击破 / 回场。 */
  allowSelf?: boolean;
};

/** 技能直伤：不乘朝向。无敌或同队不结算（自伤除外）。 */
export function applySkillDamage(
  victim: BallBody,
  source: BallBody,
  damage: number,
  opts: SkillDamageOpts = {},
): CollisionHit | null {
  if (damage <= 0 || !victim.inPlay || !source.inPlay) {
    return null;
  }
  if (victim.invincibleRemain > 0 || source.invincibleRemain > 0) {
    return null;
  }
  const selfHit = victim.id === source.id;
  if (selfHit && !opts.allowSelf) {
    return null;
  }
  if (!selfHit && victim.team && source.team && victim.team === source.team) {
    return null;
  }
  const applied = applyHpLoss(victim, damage, opts);
  if (applied <= 0) {
    return null;
  }
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage: applied,
    zone: 'front',
    coeff: 1,
    knockback: 0,
    relSpeed: 0,
    threshold: 0,
  };
}
