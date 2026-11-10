import type { BallBody } from './ballBody';
import type { HealPulse } from './combatFloat';
import { CHAIN_ULT } from '../heroes/chainKit';

const EPS = 1e-8;
const TIME_EPS = 1e-7;
const FLASH_LIFE = 0.22;

export type EqualizeFlash = {
  ownerId: number;
  x: number;
  y: number;
  radius: number;
  remain: number;
  life: number;
};

const flashes: EqualizeFlash[] = [];
const pendingHeals: HealPulse[] = [];

export function resetChainEqualize(): void {
  flashes.length = 0;
  pendingHeals.length = 0;
}

export function listEqualizeFlashes(): EqualizeFlash[] {
  return flashes.filter((flash) => flash.remain > TIME_EPS);
}

export function tickEqualizeFlashes(dt: number): void {
  const step = Math.max(0, dt);
  if (step <= 0 || flashes.length === 0) {
    return;
  }
  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    flashes[i].remain -= step;
    if (flashes[i].remain <= TIME_EPS) {
      flashes.splice(i, 1);
    }
  }
}

/** 额外 10% 实际回血脉冲；均血调生命本身不走这里。 */
export function takeChainEqualizeHeals(): HealPulse[] {
  if (pendingHeals.length === 0) {
    return [];
  }
  const out = pendingHeals.slice();
  pendingHeals.length = 0;
  return out;
}

export function isChainUltParticipant(
  caster: Pick<BallBody, 'x' | 'y'>,
  ball: Pick<BallBody, 'x' | 'y' | 'inPlay' | 'hp' | 'invincibleRemain'>,
): boolean {
  if (!ball.inPlay || ball.hp <= 0) {
    return false;
  }
  if (ball.invincibleRemain > 0) {
    return false;
  }
  return Math.hypot(ball.x - caster.x, ball.y - caster.y) <= CHAIN_ULT.radius + EPS;
}

export function chainHpRatio(ball: Pick<BallBody, 'hp' | 'maxHp'>): number {
  if (ball.maxHp <= 0) {
    return 0;
  }
  return ball.hp / ball.maxHp;
}

/** 百分比算术平均，不按最大生命加权。 */
export function chainEqualizeAvg(ratios: readonly number[]): number {
  if (ratios.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const ratio of ratios) {
    sum += ratio;
  }
  return sum / ratios.length;
}

function isAllyOf(caster: Pick<BallBody, 'id' | 'team'>, ball: Pick<BallBody, 'id' | 'team'>): boolean {
  if (ball.id === caster.id) {
    return true;
  }
  return !!caster.team && !!ball.team && caster.team === ball.team;
}

function spawnFlash(caster: Pick<BallBody, 'id' | 'x' | 'y'>): void {
  flashes.push({
    ownerId: caster.id,
    x: caster.x,
    y: caster.y,
    radius: CHAIN_ULT.radius,
    remain: FLASH_LIFE,
    life: FLASH_LIFE,
  });
}

/**
 * 以施法者当前位置为圆心立刻结算一次。
 * 先快照百分比再同时调生命，再给圈内我方含本人加 10% 最大生命（截满）。
 * 直接改 hp：不走护盾吸收、不走普通伤害、不触发受击反伤。
 */
export function applyChainEqualize(caster: BallBody, roster: readonly BallBody[]): HealPulse[] {
  spawnFlash(caster);
  const participants = roster.filter((ball) => isChainUltParticipant(caster, ball));
  const avg = chainEqualizeAvg(participants.map(chainHpRatio));
  for (const ball of participants) {
    ball.hp = Math.min(ball.maxHp, Math.max(0, ball.maxHp * avg));
  }
  const heals: HealPulse[] = [];
  for (const ball of participants) {
    if (!isAllyOf(caster, ball)) {
      continue;
    }
    const before = ball.hp;
    ball.hp = Math.min(ball.maxHp, ball.hp + ball.maxHp * CHAIN_ULT.allyHealRatio);
    const gained = ball.hp - before;
    if (gained > 0) {
      heals.push({
        unitId: ball.id,
        amount: gained,
        x: ball.x,
        y: ball.y,
        sourceId: caster.id,
        noUltCredit: true,
      });
    }
  }
  pendingHeals.push(...heals);
  return heals;
}
