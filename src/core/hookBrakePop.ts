import type { BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import { HOOK_BRAKE_TECH } from './hookTech';
import { applySkillDamage } from './skillHits';

export function isValidTechEnemy(source: BallBody, victim: BallBody): boolean {
  if (!victim.inPlay || !source.inPlay) {
    return false;
  }
  if (victim.id === source.id) {
    return false;
  }
  if (victim.invincibleRemain > 0) {
    return false;
  }
  if (victim.team && source.team && victim.team === source.team) {
    return false;
  }
  return true;
}

export function armHookBrakePop(ball: BallBody): void {
  ball.hookBrakePopPending = true;
}

export function clearHookBrakePop(ball: BallBody): void {
  ball.hookBrakePopPending = false;
}

/** 沿现有弹出主动撞窗：窗结束即失去追加资格，不永久携带。 */
export function expireHookBrakePop(ball: BallBody): void {
  if (ball.activeRamRemain <= 0) {
    ball.hookBrakePopPending = false;
  }
}

export function consumeHookBrakePopWall(ball: BallBody): void {
  if (ball.hookBrakePopPending) {
    ball.hookBrakePopPending = false;
  }
}

/**
 * 首次碰撞：非无敌敌方追加 8 伤；墙已在别处消耗。
 * 友军 / 无敌敌人视为首次接触已用掉，不触发。
 */
export function resolveHookBrakePopContact(a: BallBody, b: BallBody): CollisionHit[] {
  const hits: CollisionHit[] = [];
  const one = tryPop(a, b);
  if (one) {
    hits.push(one);
  }
  const two = tryPop(b, a);
  if (two) {
    hits.push(two);
  }
  return hits;
}

function tryPop(source: BallBody, other: BallBody): CollisionHit | null {
  if (!source.hookBrakePopPending) {
    return null;
  }
  source.hookBrakePopPending = false;
  if (!isValidTechEnemy(source, other)) {
    return null;
  }
  return applySkillDamage(other, source, HOOK_BRAKE_TECH.extraDamage);
}
