import type { BallBody } from './ballBody';

export type HpLossOpts = {
  /** 裂镜自伤：不吃折光，避免和「自伤 24 入账」双算 */
  skipRefract?: boolean;
  /** 裂镜自伤入账量；与折光减免分路，互不叠加 */
  shatterCredit?: number;
};

/**
 * 统一掉血：折光按「无折光会掉多少 − 实际掉多少」入账。
 * 护盾 / 叠甲应先乘进 incoming，这里只记折光自己的差额。
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
  victim.hp = Math.max(0, victim.hp - applied);
  const actualLost = before - victim.hp;
  if (opts.shatterCredit != null && opts.shatterCredit > 0) {
    victim.mirrorLedger += opts.shatterCredit;
  } else if (victim.refractRemain > 0) {
    const mitigated = wouldLose - actualLost;
    if (mitigated > 0) {
      victim.mirrorLedger += mitigated;
    }
  }
  return actualLost;
}

export function consumeMirrorLedger(ball: BallBody, cap: number): number {
  const spent = Math.min(Math.max(0, ball.mirrorLedger), Math.max(0, cap));
  ball.mirrorLedger = 0;
  return spent;
}
