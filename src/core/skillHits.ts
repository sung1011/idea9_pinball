import type { BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';

/** 技能直伤：不乘朝向。无敌或同队不结算。 */
export function applySkillDamage(
  victim: BallBody,
  source: BallBody,
  damage: number,
): CollisionHit | null {
  if (damage <= 0 || !victim.inPlay || !source.inPlay) {
    return null;
  }
  if (victim.invincibleRemain > 0 || source.invincibleRemain > 0) {
    return null;
  }
  if (victim.team && source.team && victim.team === source.team) {
    return null;
  }
  victim.hp = Math.max(0, victim.hp - damage);
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage,
    zone: 'front',
    coeff: 1,
    knockback: 0,
    relSpeed: 0,
    threshold: 0,
  };
}
