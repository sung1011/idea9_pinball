import { outgoingDamageMul, type BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import { applyHpLoss, type HpLossOpts } from './hpLoss';

export type SkillDamageOpts = HpLossOpts & {
  /** 裂镜自伤：允许打自己，仍走无敌 / 击破 / 回场。 */
  allowSelf?: boolean;
  /** 沉磁井等独立场圈：施法者阵亡/无敌仍可结算，只看受击方无敌。 */
  allowOfflineSource?: boolean;
  /** 必杀直伤：不给施法者回充能量 */
  noUltCredit?: boolean;
};

/** 技能直伤：不走枪尖门闩 / 碰撞公式。无敌或同队不结算（自伤除外）。 */
export function applySkillDamage(
  victim: BallBody,
  source: BallBody,
  damage: number,
  opts: SkillDamageOpts = {},
): CollisionHit | null {
  if (damage <= 0 || !victim.inPlay) {
    return null;
  }
  if (!opts.allowOfflineSource && !source.inPlay) {
    return null;
  }
  if (victim.invincibleRemain > 0) {
    return null;
  }
  if (!opts.allowOfflineSource && source.invincibleRemain > 0) {
    return null;
  }
  const selfHit = victim.id === source.id;
  if (selfHit && !opts.allowSelf) {
    return null;
  }
  if (!selfHit && victim.team && source.team && victim.team === source.team) {
    return null;
  }
  const applied = applyHpLoss(victim, damage * outgoingDamageMul(source), opts);
  if (applied <= 0) {
    return null;
  }
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage: applied,
    knockback: 0,
    relSpeed: 0,
    threshold: 0,
    noUltCredit: opts.noUltCredit || undefined,
  };
}
