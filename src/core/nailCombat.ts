import { clearReflect, type BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import { NAIL_PIN, NAIL_THORN } from '../heroes/nailKit';
import { applySkillDamage } from './skillHits';
import { unitVec } from './skillQuery';

function pushAway(target: BallBody, from: BallBody, speed: number): void {
  const dir = unitVec(target.x - from.x, target.y - from.y);
  if (!dir) {
    return;
  }
  target.vx += dir.x * speed;
  target.vy += dir.y * speed;
  target.allowOverCap = true;
}

/** 反击刺：主动窗优先反 16；否则被主动撞立刻反 12 + 小推。 */
export function applyNailReflect(
  victim: BallBody,
  source: BallBody,
  isActiveRam: boolean,
): CollisionHit | null {
  if (victim.reflectRemain > 0 && victim.reflectArmed) {
    const hit = applySkillDamage(source, victim, victim.reflectDamage);
    if (victim.reflectOnce) {
      clearReflect(victim);
    }
    return hit;
  }
  if (victim.hero !== 'nail' || !isActiveRam) {
    return null;
  }
  const hit = applySkillDamage(source, victim, NAIL_THORN.passiveDamage);
  pushAway(source, victim, NAIL_THORN.passivePush);
  victim.reflectRemain = NAIL_THORN.passiveWindow;
  victim.reflectDamage = NAIL_THORN.passiveDamage;
  victim.reflectOnce = false;
  victim.reflectArmed = false;
  return hit;
}

/** 定锚期间被钉壳友军主动撞额外 10。 */
export function applyPinRamBonus(victim: BallBody, source: BallBody): CollisionHit | null {
  if (victim.pinRemain <= 0) {
    return null;
  }
  if (!victim.pinnedByTeam || source.team !== victim.pinnedByTeam) {
    return null;
  }
  if (source.activeRamRemain <= 0) {
    return null;
  }
  return applySkillDamage(victim, source, NAIL_PIN.allyRamExtra);
}
