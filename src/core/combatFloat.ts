import type { BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';

export type CombatFloatKind = 'damage' | 'heal' | 'shield';

export type CombatFloatEvent = {
  kind: CombatFloatKind;
  amount: number;
  x: number;
  y: number;
  unitId: number;
};

export type HealPulse = {
  unitId: number;
  amount: number;
  x: number;
  y: number;
};

/** 伤害红橙 / 治疗绿 / 护盾青（护盾无数值事件则跳过）。 */
export const COMBAT_FLOAT_COLOR = {
  damage: 0xff6a2a,
  heal: 0x3dcc6f,
  shield: 0x3ec8d8,
} as const;

export const COMBAT_FLOAT_LIFE = 0.72;
export const COMBAT_FLOAT_RISE = 0.82;

const healRemainAcc = new Map<number, number>();

export function resetCombatFloatAcc(): void {
  healRemainAcc.clear();
}

/** 只显示数字：伤害 `-12`，治疗/护盾 `+8`。 */
export function formatCombatFloat(kind: CombatFloatKind, amount: number): string {
  const n = displayAmount(amount);
  if (kind === 'damage') {
    return `-${n}`;
  }
  return `+${n}`;
}

export function displayAmount(amount: number): number {
  const n = Math.round(Math.abs(amount));
  return n > 0 ? n : 1;
}

export function combatFloatColor(kind: CombatFloatKind): number {
  return COMBAT_FLOAT_COLOR[kind];
}

/** 同单位同帧错开，避免挤成一团。 */
export function combatFloatStackOffset(index: number): { dx: number; dy: number } {
  if (index <= 0) {
    return { dx: 0, dy: 0 };
  }
  const side = index % 2 === 0 ? -1 : 1;
  const mag = Math.ceil(index / 2);
  const row = Math.floor((index - 1) / 2);
  return { dx: side * mag * 0.34, dy: -row * 0.22 };
}

export function floatsFromHits(
  hits: readonly CollisionHit[],
  balls: readonly BallBody[],
): CombatFloatEvent[] {
  if (hits.length === 0) {
    return [];
  }
  const byId = new Map(balls.map((ball) => [ball.id, ball]));
  const events: CombatFloatEvent[] = [];
  for (const hit of hits) {
    if (hit.damage <= 0) {
      continue;
    }
    const victim = byId.get(hit.victimId);
    if (!victim) {
      continue;
    }
    events.push({
      kind: 'damage',
      amount: hit.damage,
      x: victim.x,
      y: victim.y,
      unitId: victim.id,
    });
  }
  return events;
}

/**
 * HOT 按整数冒出；单次 ≥1（如甲垒回 8）当场弹出。
 * 不改回血公式，只把已结算增量收成可读数字。
 */
export function takeHealFloats(pulses: readonly HealPulse[]): CombatFloatEvent[] {
  const events: CombatFloatEvent[] = [];
  for (const pulse of pulses) {
    if (pulse.amount <= 0) {
      continue;
    }
    const prev = healRemainAcc.get(pulse.unitId) ?? 0;
    const total = prev + pulse.amount;
    const shown = Math.floor(total + 1e-9);
    const rest = total - shown;
    if (shown > 0) {
      events.push({
        kind: 'heal',
        amount: shown,
        x: pulse.x,
        y: pulse.y,
        unitId: pulse.unitId,
      });
    }
    if (rest > 1e-9) {
      healRemainAcc.set(pulse.unitId, rest);
    } else {
      healRemainAcc.delete(pulse.unitId);
    }
  }
  return events;
}

/** 护盾色通道：有数值才出字；当前减伤盾无吸收量则跳过。 */
export function floatsFromShield(pulses: readonly HealPulse[]): CombatFloatEvent[] {
  const events: CombatFloatEvent[] = [];
  for (const pulse of pulses) {
    if (pulse.amount <= 0) {
      continue;
    }
    events.push({
      kind: 'shield',
      amount: pulse.amount,
      x: pulse.x,
      y: pulse.y,
      unitId: pulse.unitId,
    });
  }
  return events;
}
