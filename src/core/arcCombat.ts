import { ARC_GRAZE, ARC_MARK } from '../heroes/arcKit';
import type { CollisionHit } from './collisionDamage';
import type { BallBody } from './ballBody';
import { outgoingDamageMul } from './ballBody';
import { applyHpLoss } from './hpLoss';
import { applySkillDamage } from './skillHits';

/** 刀刃荼毒：下次枪尖普攻成功掉血后加 6，然后清毒。未成功戳中不消耗。 */
export function consumeBladeVenom(source: BallBody, victim: BallBody): number {
  if (source.grazeRemain <= 0) {
    return 0;
  }
  source.grazeRemain = 0;
  source.grazeLocks.length = 0;
  return applyHpLoss(victim, ARC_GRAZE.extra * outgoingDamageMul(source));
}

/** 标记回响：下一次主动撞或擦伤额外 14，然后清标记。 */
export function tryEchoMark(
  victim: BallBody,
  source: BallBody,
  trigger: boolean,
): CollisionHit | null {
  if (!trigger || victim.echoMarkRemain <= 0) {
    return null;
  }
  const hit = applySkillDamage(victim, source, ARC_MARK.extra);
  victim.echoMarkRemain = 0;
  victim.echoMarkSourceId = -1;
  return hit;
}

/** 碰撞结算后：吃标记回响（主动撞仍触发；擦伤窗已改为荼毒，不再走擦肩）。 */
export function applyArcOnCollision(a: BallBody, b: BallBody): CollisionHit[] {
  const hits: CollisionHit[] = [];
  const markB = tryEchoMark(b, a, a.activeRamRemain > 0);
  if (markB) {
    hits.push(markB);
  }
  const markA = tryEchoMark(a, b, b.activeRamRemain > 0);
  if (markA) {
    hits.push(markA);
  }
  return hits;
}
