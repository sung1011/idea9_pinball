import type { BallBody, TeamId } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HealPulse } from './combatFloat';

export type CombatStatTab = 'damage' | 'heal';

export type CombatStatTotals = {
  damage: number;
  heal: number;
};

export type CombatStatRow = {
  unitId: number;
  label: string;
  team: TeamId | undefined;
  teamSlot: number;
  isMe: boolean;
  order: number;
  damage: number;
  heal: number;
  value: number;
};

export type CombatStats = {
  applyHits: (hits: readonly CollisionHit[]) => void;
  applyHeals: (pulses: readonly HealPulse[]) => void;
  totalsOf: (unitId: number) => CombatStatTotals;
  snapshot: (balls: readonly BallBody[], playerId: number, tab: CombatStatTab) => CombatStatRow[];
  reset: () => void;
};

function emptyTotals(): CombatStatTotals {
  return { damage: 0, heal: 0 };
}

function credit(map: Map<number, CombatStatTotals>, sourceId: number, key: 'damage' | 'heal', amount: number): void {
  if (sourceId < 0 || amount <= 0) {
    return;
  }
  let row = map.get(sourceId);
  if (!row) {
    row = emptyTotals();
    map.set(sourceId, row);
  }
  row[key] += amount;
}

/** 本局实际扣血 / 实际回血账本：过量与无施法者不入账；自伤与环境不算输出。 */
export function createCombatStats(): CombatStats {
  const totals = new Map<number, CombatStatTotals>();

  return {
    applyHits(hits) {
      for (const hit of hits) {
        if (hit.damage <= 0 || hit.environment) {
          continue;
        }
        if (hit.sourceId === hit.victimId) {
          continue;
        }
        credit(totals, hit.sourceId, 'damage', hit.damage);
      }
    },
    applyHeals(pulses) {
      for (const pulse of pulses) {
        if (pulse.amount <= 0 || pulse.sourceId == null) {
          continue;
        }
        credit(totals, pulse.sourceId, 'heal', pulse.amount);
      }
    },
    totalsOf(unitId) {
      const row = totals.get(unitId);
      return row ? { damage: row.damage, heal: row.heal } : emptyTotals();
    },
    snapshot(balls, playerId, tab) {
      const rows: CombatStatRow[] = balls.map((ball, order) => {
        const got = totals.get(ball.id) ?? emptyTotals();
        return {
          unitId: ball.id,
          label: ball.label,
          team: ball.team,
          teamSlot: ball.teamSlot,
          isMe: ball.id === playerId,
          order,
          damage: got.damage,
          heal: got.heal,
          value: tab === 'heal' ? got.heal : got.damage,
        };
      });
      rows.sort((a, b) => {
        if (b.value !== a.value) {
          return b.value - a.value;
        }
        return a.order - b.order;
      });
      return rows;
    },
    reset() {
      totals.clear();
    },
  };
}

export function formatStatLabel(label: string, isMe: boolean): string {
  return isMe ? `${label} · 我` : label;
}

export function formatStatValue(amount: number): string {
  return String(Math.round(amount));
}

export function statBarRatio(value: number, maxValue: number): number {
  if (maxValue <= 0 || value <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, value / maxValue));
}
