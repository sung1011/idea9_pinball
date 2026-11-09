import type { BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HealPulse } from './combatFloat';

export const ULT_ENERGY_MAX = 100;
export const ULT_ENERGY_PASSIVE_PER_SEC = 2;
export const ULT_ENERGY_BONUS_PER_DAMAGE = 0.1;
export const ULT_ENERGY_BONUS_CAP_PER_SEC = 2;
export const ULT_ENERGY_TOTAL_CAP_PER_SEC = 4;

const EPS = 1e-8;

export function clearUltEnergy(ball: BallBody): void {
  ball.ultEnergy = 0;
  ball.ultCombatCredit = 0;
}

export function canSpendUlt(ball: BallBody, cost = ULT_ENERGY_MAX): boolean {
  return ball.ultEnergy + EPS >= cost;
}

export function spendUltEnergy(ball: BallBody, cost = ULT_ENERGY_MAX): boolean {
  if (!canSpendUlt(ball, cost)) {
    return false;
  }
  ball.ultEnergy = Math.max(0, ball.ultEnergy - cost);
  return true;
}

/** 在场才回复；死亡暂停、能量保留。战斗加成 1/10 且每秒最多 +2，总回复封顶 4/s。 */
export function tickUltEnergy(ball: BallBody, dt: number): void {
  const step = Math.max(0, dt);
  if (step <= 0 || !ball.inPlay) {
    return;
  }
  const passive = ULT_ENERGY_PASSIVE_PER_SEC * step;
  const wantBonus = ball.ultCombatCredit * ULT_ENERGY_BONUS_PER_DAMAGE;
  const bonus = Math.min(wantBonus, ULT_ENERGY_BONUS_CAP_PER_SEC * step);
  ball.ultCombatCredit = Math.max(0, ball.ultCombatCredit - bonus / ULT_ENERGY_BONUS_PER_DAMAGE);
  const gain = Math.min(passive + bonus, ULT_ENERGY_TOTAL_CAP_PER_SEC * step);
  ball.ultEnergy = Math.min(ULT_ENERGY_MAX, ball.ultEnergy + gain);
}

/** 有效伤害/治疗入账：环境、自伤、无施法者不计；药水治疗不走这里。 */
export function creditUltCombat(balls: readonly BallBody[], hits: readonly CollisionHit[], heals: readonly HealPulse[] = []): void {
  for (const hit of hits) {
    if (hit.damage <= 0 || hit.environment || hit.sourceId === hit.victimId) {
      continue;
    }
    const source = balls.find((ball) => ball.id === hit.sourceId);
    if (source) {
      source.ultCombatCredit += hit.damage;
    }
  }
  for (const heal of heals) {
    if (heal.amount <= 0 || heal.sourceId == null || heal.sourceId < 0) {
      continue;
    }
    const source = balls.find((ball) => ball.id === heal.sourceId);
    if (source) {
      source.ultCombatCredit += heal.amount;
    }
  }
}
