import type { BallBody } from './ballBody';
import type { HealPulse } from './combatFloat';

export type HpLossOpts = {
  /** 裂镜自伤：不吃折光，避免和「自伤 24 入账」双算 */
  skipRefract?: boolean;
  /** 裂镜自伤入账量；与折光减免分路，互不叠加 */
  shatterCredit?: number;
};

const shieldAbsorbs: HealPulse[] = [];

export function takeShieldAbsorbs(): HealPulse[] {
  if (shieldAbsorbs.length === 0) {
    return [];
  }
  const out = shieldAbsorbs.slice();
  shieldAbsorbs.length = 0;
  return out;
}

/**
 * 统一掉血：折光按「无折光会掉多少 − 实际掉多少」入账。
 * 护盾 / 叠甲应先乘进 incoming，这里只记折光自己的差额。
 * 药水护盾在折光之后吸收，不记入反照账本。
 */
export function applyHpLoss(victim: BallBody, incoming: number, opts: HpLossOpts = {}): number {
  if (incoming <= 0 || !victim.inPlay) {
    return 0;
  }
  const before = victim.hp;
  const wouldLose = Math.min(before, incoming);
  let applied = incoming;
  if (!opts.skipRefract && victim.refractRemain > 0) {
    applied = incoming * 0.5;
  }
  if (opts.shatterCredit != null && opts.shatterCredit > 0) {
    victim.mirrorLedger += opts.shatterCredit;
  } else if (victim.refractRemain > 0) {
    const mitigated = wouldLose - Math.min(before, applied);
    if (mitigated > 0) {
      victim.mirrorLedger += mitigated;
    }
  }
  if (victim.potionShieldHp > 0 && victim.potionShieldRemain > 0) {
    const absorbed = Math.min(victim.potionShieldHp, applied);
    if (absorbed > 0) {
      victim.potionShieldHp -= absorbed;
      applied -= absorbed;
      shieldAbsorbs.push({ unitId: victim.id, amount: absorbed, x: victim.x, y: victim.y });
      if (victim.potionShieldHp <= 1e-6) {
        victim.potionShieldHp = 0;
        victim.potionShieldRemain = 0;
      }
    }
  }
  victim.hp = Math.max(0, victim.hp - applied);
  return before - victim.hp;
}

export function consumeMirrorLedger(ball: BallBody, cap: number): number {
  const spent = Math.min(Math.max(0, ball.mirrorLedger), Math.max(0, cap));
  ball.mirrorLedger = 0;
  return spent;
}
